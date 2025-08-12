import { GameState, BoardState, Movement, Coord } from '@core/types';
import { tick as engineTick, applyMovement } from '@core/engine';
import { generateRandomMap } from '@core/map/generate-grid';
import { getGame } from '@/game/actions/get-game';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';
import type { GameWithPlayers } from '@common/types/games';
import { getGlobalWebSocketManager } from '@/websocket/global-manager';
import { removeUserFromGame } from './gameplay-ws-api';
import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';
import { GameRepository } from '@/game/game-repository';
import { GameStatus } from '@/game/types';

interface QueuedMove {
  sourceCoord: Coord;
  movement: Movement;
}

export class GameServer {
  private gameId: number;
  private gameState: GameState | null = null;
  private playerQueues: Map<number, QueuedMove[]> = new Map();
  private roomName: string;
  private playerMapping: Map<string, number> = new Map(); // userId -> playerIndex
  private gameStarted: boolean = false;
  private gameEnded: boolean = false;
  private initialized: boolean = false;
  
  constructor(gameId: number) {
    this.gameId = gameId;
    this.roomName = `gameplay-${gameId}`;
    console.log(`[GameServer] Created for game ${gameId}`);
    this.initializeGame();
  }

  private async initializeGame(): Promise<void> {
    try {
      const gameData = await getGame(this.gameId);
      if (!gameData) {
        throw new Error(`Game ${this.gameId} not found in database`);
      }

      this.initializeGameState(gameData);
      this.setupPlayerMappings(gameData);
      this.initializePlayerQueues();
      this.initialized = true;
      
      console.log(`[GameServer] Game ${this.gameId} initialized with ${gameData.players.length} players`);
    } catch (error) {
      console.error(`[GameServer] Failed to initialize game ${this.gameId}:`, error);
      throw error;
    }
  }

  private initializeGameState(gameData: GameWithPlayers): void {
    const mapData = generateRandomMap({ 
      width: 10, 
      height: 10 
    }, gameData.players.length);

    const boardState: BoardState = {
      grid: mapData.grid,
      size: { width: 10, height: 10 }
    };

    this.gameState = {
      board: boardState,
      tick: 0,
      config: gameData.config
    };
  }

  private setupPlayerMappings(gameData: GameWithPlayers): void {
    gameData.players.forEach((player, index) => {
      this.playerMapping.set(player.player_id.toString(), index);
    });
  }

  private initializePlayerQueues(): void {
    for (const playerIndex of this.playerMapping.values()) {
      this.playerQueues.set(playerIndex, []);
    }
  }

  async tick(): Promise<boolean> {
    if (!this.initialized || !this.gameState || this.gameEnded) {
      return this.gameEnded;
    }

    try {
      this.processPlayerMoves();
      
      const tickResult = engineTick(this.gameState.board, this.gameState.tick);
      this.gameState.tick++;
      
      if (tickResult.gameEnded) {
        await this.handleGameEnd(tickResult.winnerPlayerIndex!);
        return true;
      }

      this.broadcastGameState();
      return false;
    } catch (error) {
      console.error(`[GameServer] Error during tick for game ${this.gameId}:`, error);
      this.gameEnded = true;
      return true;
    }
  }

  private processPlayerMoves(): void {
    if (!this.gameState) return;

    for (const [playerIndex, moveQueue] of this.playerQueues) {
      if (moveQueue.length === 0) continue;

      const queuedMove = moveQueue.shift()!;
      const { sourceCoord, movement } = queuedMove;
      
      try {
        // Validate at tick time - deferred validation allows queuing moves from future conquests
        if (!Board.isCoordValid(this.gameState.board, sourceCoord)) {
          console.log(`[GameServer] Invalid source coordinate ${sourceCoord.x},${sourceCoord.y} for player ${playerIndex} in game ${this.gameId}`);
          continue;
        }

        const sourceSquare = Board.getSquare(this.gameState.board, sourceCoord);
        
        // Check if player owns this tile (deferred validation)
        if (!isPlayerSquare(sourceSquare) || sourceSquare.playerIndex !== playerIndex) {
          console.log(`[GameServer] Player ${playerIndex} cannot move from ${sourceCoord.x},${sourceCoord.y} - not owned in game ${this.gameId}`);
          continue;
        }

        // Check if tile has enough units to move
        if (sourceSquare.units <= 1) {
          console.log(`[GameServer] Player ${playerIndex} cannot move from ${sourceCoord.x},${sourceCoord.y} - insufficient units (${sourceSquare.units}) in game ${this.gameId}`);
          continue;
        }

        // Apply the movement
        console.log(`[GameServer] Processing move ${movement} from ${sourceCoord.x},${sourceCoord.y} for player ${playerIndex} in game ${this.gameId}`);
        applyMovement(this.gameState.board, sourceCoord, movement);
        
      } catch (error) {
        console.log(`[GameServer] Invalid move ${movement} from ${sourceCoord.x},${sourceCoord.y} for player ${playerIndex} in game ${this.gameId}:`, error);
      }
    }
  }

  private async handleGameEnd(winnerPlayerIndex: number): Promise<void> {
    console.log(`[GameServer] Game ${this.gameId} ended, winner: player ${winnerPlayerIndex}`);
    this.gameEnded = true;
    
    // Update game status to COMPLETE in database
    const gameRepository = new GameRepository();
    await gameRepository.updateStatus(this.gameId, GameStatus.COMPLETE);
    
    this.broadcastGameEnd(winnerPlayerIndex);
  }

  private broadcastGameState(): void {
    if (!this.gameState) return;

    try {
      const wsManager = getGlobalWebSocketManager();
      wsManager.serverBroadcastToRoom(this.roomName, {
        domain: GAMEPLAY_DOMAIN,
        type: 'game-state-update',
        payload: {
          tick: this.gameState.tick,
          boardState: this.gameState.board
        }
      });
    } catch (error) {
      console.error(`[GameServer] Failed to broadcast game state for game ${this.gameId}:`, error);
    }
  }

  private broadcastGameEnd(winnerPlayerIndex: number): void {
    if (!this.gameState) return;

    try {
      const wsManager = getGlobalWebSocketManager();
      wsManager.serverBroadcastToRoom(this.roomName, {
        domain: GAMEPLAY_DOMAIN,
        type: 'game-ended',
        payload: {
          winner: winnerPlayerIndex,
          reason: 'general_captured',
          finalBoardState: this.gameState.board
        }
      });
    } catch (error) {
      console.error(`[GameServer] Failed to broadcast game end for game ${this.gameId}:`, error);
    }
  }

  queueMove(userId: string, sourceCoord: Coord, movement: Movement): void {
    const playerIndex = this.playerMapping.get(userId);
    if (playerIndex === undefined) {
      console.log(`[GameServer] Move request from unknown user ${userId} in game ${this.gameId}`);
      return;
    }

    const queue = this.playerQueues.get(playerIndex);
    if (!queue) {
      console.log(`[GameServer] No queue found for player ${playerIndex} in game ${this.gameId}`);
      return;
    }

    // Basic validation at queue time - only check bounds, not ownership
    if (!this.gameState || !Board.isCoordValid(this.gameState.board, sourceCoord)) {
      console.log(`[GameServer] Invalid coordinates ${sourceCoord.x},${sourceCoord.y} for move request from user ${userId} in game ${this.gameId}`);
      return;
    }

    const queuedMove: QueuedMove = { sourceCoord, movement };
    queue.push(queuedMove);
    
    console.log(`[GameServer] Queued move ${movement} from ${sourceCoord.x},${sourceCoord.y} for player ${playerIndex} in game ${this.gameId}, queue length: ${queue.length}`);
  }

  clearMoves(userId: string): void {
    const playerIndex = this.playerMapping.get(userId);
    if (playerIndex === undefined) {
      console.log(`[GameServer] Clear moves request from unknown user ${userId} in game ${this.gameId}`);
      return;
    }

    const queue = this.playerQueues.get(playerIndex);
    if (queue) {
      queue.length = 0;
      console.log(`[GameServer] Cleared move queue for player ${playerIndex} in game ${this.gameId}`);
    }
  }


  startGame(): void {
    if (this.gameStarted || !this.initialized || !this.gameState) {
      return;
    }

    this.gameStarted = true;
    console.log(`[GameServer] Starting game ${this.gameId}`);

    // TODO: Send GameStarted message to all players in room
    this.broadcastGameStart();
  }

  private broadcastGameStart(): void {
    if (!this.gameState) return;

    try {
      const wsManager = getGlobalWebSocketManager();
      wsManager.serverBroadcastToRoom(this.roomName, {
        domain: GAMEPLAY_DOMAIN,
        type: 'game-started',
        payload: {
          gameId: this.gameId,
          playerMapping: this.getPlayerMapping(),
          boardState: this.gameState.board
        }
      });
    } catch (error) {
      console.error(`[GameServer] Failed to broadcast game start for game ${this.gameId}:`, error);
    }
  }

  getRoomName(): string {
    return this.roomName;
  }

  getPlayerMapping(): Array<{ playerId: string, playerIndex: number }> {
    return Array.from(this.playerMapping.entries()).map(([playerId, playerIndex]) => ({
      playerId,
      playerIndex
    }));
  }

  isGameEnded(): boolean {
    return this.gameEnded;
  }

  cleanup(): void {
    console.log(`[GameServer] Cleaning up game ${this.gameId}`);
    
    // Clean up user-game mappings
    for (const userId of this.playerMapping.keys()) {
      removeUserFromGame(userId);
    }
    
    this.playerQueues.clear();
    this.gameEnded = true;
  }
}