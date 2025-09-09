import { GameState, BoardState, Movement, Coord } from '@core/types';
import { tick as engineTick, applyMovement } from '@core/engine';
import { GameGenerationConfig } from '@core/game-generation-config';
import { DEFAULT_GAME_GENERATION_CONFIG } from '@core/default-game-config';
import { getGame } from '@/game/actions/get-game';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';
import type { GameWithPlayers } from '@common/types/games';
import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';
import {
  FALLBACK_TIMER_MS,
  ONE_SECOND_MS,
  PRE_GAME_COUNTDOWN_SECONDS,
} from '@core/ui-timing-config';

import { createScopedLogger } from '@/utils/scoped-logger';
import { getGlobalWebSocketManager } from '@/websocket/global-manager';
import { removeUserFromGame } from '@/gameplay/gameplay-ws-api';
import { GameRepository } from '@/game/game-repository';
import { GameStatus } from '@/game/types';
import { endGame } from '@/game/actions/end-game';

const MAX_QUEUED_MOVES_PER_PLAYER = 200;

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
  private connectedPlayers: Set<string> = new Set(); // userIds who joined gameplay room
  private expectedPlayerCount: number = 0;
  private gameStarted: boolean = false;
  private gameEnded: boolean = false;
  private initialized: boolean = false;
  private countdownActive: boolean = false;
  private countdownSeconds: number = PRE_GAME_COUNTDOWN_SECONDS;
  private countdownInterval: NodeJS.Timeout | null = null;
  private fallbackTimer: NodeJS.Timeout | null = null;
  private log = createScopedLogger(() => `GameServer id=${this.gameId}`);

  constructor(gameId: number) {
    this.gameId = gameId;
    this.roomName = `gameplay-${gameId}`;
    this.log.debug('New GameServer');
    this.initializeGame();
  }

  private async initializeGame(): Promise<void> {
    try {
      const game = await getGame(this.gameId);
      if (!game) {
        throw new Error(`Game ${this.gameId} not found in database`);
      }

      this.initializeGameState(game, DEFAULT_GAME_GENERATION_CONFIG);
      this.setupPlayerMappings(game);
      this.initializePlayerQueues();
      this.expectedPlayerCount = game.players.length;
      this.initialized = true;

      // Start fallback timer to ensure countdown starts even if not all players join
      this.startFallbackTimer();

      this.log.debug('Game initialized with ${game.players.length} players');
    } catch (error) {
      this.log.error('Failed to initialize game. Error:', error);
      throw error;
    }
  }

  private initializeGameState(
    game: GameWithPlayers,
    generationConfig: GameGenerationConfig,
  ): void {
    if (!game) {
      throw new Error(`Cannot initialize game state: game data is null`);
    }
    const boardState: BoardState = {
      grid: game.config.startingGrid,
      size: generationConfig.mapSize,
    };
    this.gameState = {
      board: boardState,
      tick: 0,
      config: game.config,
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

  private getPlayerQueue(playerIndex: number): QueuedMove[] {
    const queue = this.playerQueues.get(playerIndex);
    if (!queue) {
      throw new Error(`No move queue found for player index ${playerIndex}`);
    }
    return queue;
  }

  // TODO: When game ends, we broadcast twice
  // - broadcastGameState
  // - broadcastGameEnd
  async tick(): Promise<boolean> {
    // --------------------------------------------------------------------
    // TODO: Improve the flow of the entire game startup process...
    // TODO: shouldn't check both of these, should have 1 source of truth
    // --------------------------------------------------------------------
    // Don't tick if game not started / countdown is still active
    if (this.countdownActive || !this.gameStarted) {
      return false;
    }
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
      this.log.error(`Error during tick ${this.gameState?.tick}:`, error);
      this.gameEnded = true;
      return true;
    }
  }

  private processPlayerMoves(): void {
    if (!this.gameState) return;

    for (const [playerIndex, moveQueue] of this.playerQueues) {
      if (moveQueue.length === 0) continue;

      const queuedMove = moveQueue.shift()!;
      const { sourceCoord: source, movement } = queuedMove;

      try {
        // Validate at tick time - deferred validation allows queuing moves from future conquests
        if (!Board.isCoordValid(this.gameState.board, source)) {
          this.log.error(
            `Invalid source coords ${source.x},${source.y} for player ${playerIndex}`,
          );
          continue;
        }

        const sourceSquare = Board.getSquare(this.gameState.board, source);

        // Check if player owns this tile (deferred validation)
        // TODO: make this if check cleaner, maybe w/ some helper
        if (
          !isPlayerSquare(sourceSquare) ||
          sourceSquare.playerIndex !== playerIndex
        ) {
          continue;
        }

        if (sourceSquare.units <= 1) {
          continue;
        }
        applyMovement(this.gameState.board, source, movement);
      } catch (error) {
        this.log.error(
          `Invalid move ${movement} from ${source.x},${source.y} for player ${playerIndex}`,
          error,
        );
      }
    }
  }

  private async handleGameEnd(winnerPlayerIndex: number): Promise<void> {
    this.log.info(`Game ended, winner: player ${winnerPlayerIndex}`);
    this.gameEnded = true;

    // Update game status and save final game state to database
    if (this.gameState) {
      await endGame({
        gameId: this.gameId,
        winnerPlayerIndex,
        finalGameState: this.gameState,
        reason: 'general_captured',
      });
    } else {
      throw new Error(`Game ${this.gameId} has no state to end`);
    }

    this.broadcastGameEnd(winnerPlayerIndex);
  }

  private getPlayerQueuesForBroadcast(): Record<
    number,
    Array<{ sourceCoord: Coord; direction: Movement }>
  > {
    const result: Record<
      number,
      Array<{ sourceCoord: Coord; direction: Movement }>
    > = {};
    for (const [playerIndex, queue] of this.playerQueues) {
      result[playerIndex] = queue.map((move) => ({
        sourceCoord: move.sourceCoord,
        direction: move.movement,
      }));
    }
    return result;
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
          boardState: this.gameState.board,
          playerQueues: this.getPlayerQueuesForBroadcast(),
        },
      });
    } catch (error) {
      this.log.error('Failed to broadcast game state. Error:', error);
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
          finalBoardState: this.gameState.board,
        },
      });
    } catch (error) {
      this.log.error(`Failed to broadcast game end. Error:`, error);
    }
  }

  queueMove(userId: string, source: Coord, movement: Movement): void {
    const playerIndex = this.playerMapping.get(userId);
    if (playerIndex === undefined) {
      this.log.info(`Move request from unknown user ${userId}`);
      return;
    }
    const queue = this.getPlayerQueue(playerIndex);

    // Basic validation at queue time - only check bounds, not ownership
    if (!this.gameState || !Board.isCoordValid(this.gameState.board, source)) {
      this.log.error(
        `Invalid coords ${source.x},${source.y} for move request from user ${userId}`,
      );
      return;
    }

    if (queue.length >= MAX_QUEUED_MOVES_PER_PLAYER) {
      this.log.info(
        `Move Queue full for user ${userId} (${queue.length} moves), skipping.`,
      );
      return;
    }

    const queuedMove: QueuedMove = { sourceCoord: source, movement };
    queue.push(queuedMove);
  }

  clearMoves(userId: string): void {
    const playerIndex = this.playerMapping.get(userId);
    if (playerIndex === undefined) {
      this.log.error(`Clear moves request from unknown user ${userId}`);
      return;
    }

    const queue = this.getPlayerQueue(playerIndex);
    if (queue) {
      queue.length = 0;
      this.log.debug(`Cleared move queue for player ${playerIndex}`);
    }
  }

  onPlayerJoinedRoom(userId: string): void {
    if (!this.playerMapping.has(userId)) {
      this.log.error(`User ${userId} not part of game, ignoring join`);
      return;
    }

    this.connectedPlayers.add(userId);
    const playerCountStr = `${this.connectedPlayers.size}/${this.expectedPlayerCount}`;
    this.log.debug(`Player ${userId} joined game room (${playerCountStr})`);

    // Start countdown when we have enough players (or at least 1)
    if (
      this.connectedPlayers.size >= Math.min(1, this.expectedPlayerCount) &&
      !this.countdownActive &&
      !this.gameStarted
    ) {
      this.clearFallbackTimer();
      this.startCountdown();
    }
  }

  // ---------------------------------------------------------------------------------
  // TODO: Revisit this entire part of the game startup flow
  // I think we want something like:
  //   - Game should only start if at least 2 players are connected
  //   - Otherwise, mark game as "failed to start" after X seconds (e.g. 15 secondds)
  // ---------------------------------------------------------------------------------
  private startFallbackTimer(): void {
    // Start countdown after fallback delay even if not all players joined
    this.fallbackTimer = setTimeout(() => {
      if (
        !this.countdownActive &&
        !this.gameStarted &&
        this.connectedPlayers.size > 0
      ) {
        this.log.error(
          `Fallback countdown with ${this.connectedPlayers.size} players`,
        );
        this.startCountdown();
      }
    }, FALLBACK_TIMER_MS);
  }

  private clearFallbackTimer(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  startCountdown(): void {
    if (this.countdownActive || this.gameStarted || !this.initialized) {
      return;
    }

    this.countdownActive = true;
    this.log.debug('Starting countdown for game');

    this.broadcastGameStarting();

    this.countdownInterval = setInterval(() => {
      this.countdownSeconds--;

      if (this.countdownSeconds <= 0) {
        this.finishCountdown();
      } else {
        this.broadcastGameStarting();
      }
    }, ONE_SECOND_MS);
  }

  private async finishCountdown(): Promise<void> {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.countdownActive = false;
    await this.startGame();
  }

  private broadcastGameStarting(): void {
    try {
      const wsManager = getGlobalWebSocketManager();
      wsManager.serverBroadcastToRoom(this.roomName, {
        domain: GAMEPLAY_DOMAIN,
        type: 'game-starting',
        payload: {
          gameId: this.gameId,
          countdown: this.countdownSeconds,
        },
      });
    } catch (error) {
      this.log.error('Failed to broadcast game-starting. Error:', error);
    }
  }

  async startGame(): Promise<void> {
    if (this.gameStarted || !this.initialized || !this.gameState) {
      return;
    }

    this.gameStarted = true;
    this.log.debug('Starting game');

    // Update game status to IN_PROGRESS in database
    try {
      const gameRepository = new GameRepository();
      await gameRepository.updateStatus(this.gameId, GameStatus.IN_PROGRESS);

      // Get the updated game object with new status
      const updatedGame = await getGame(this.gameId);
      if (!updatedGame) {
        throw new Error(`Game ${this.gameId} not found after starting`);
      }
      await this.broadcastGameStart(updatedGame);
    } catch (error) {
      this.log.error(`Failed to update game status for game. Error:`, error);
    }
  }

  private async broadcastGameStart(game: GameWithPlayers): Promise<void> {
    if (!this.gameState) return;

    try {
      const wsManager = getGlobalWebSocketManager();
      const payload: any = {
        gameId: this.gameId,
        playerMapping: this.getPlayerMapping(),
        boardState: this.gameState.board,
      };

      // Include the full game object if available
      if (game) {
        payload.game = game;
      }

      wsManager.serverBroadcastToRoom(this.roomName, {
        domain: GAMEPLAY_DOMAIN,
        type: 'game-started',
        payload,
      });
    } catch (error) {
      this.log.error(`Failed to broadcast game start`, error);
    }
  }

  getRoomName(): string {
    return this.roomName;
  }

  getPlayerMapping(): Array<{ playerId: string; playerIndex: number }> {
    return Array.from(this.playerMapping.entries()).map(
      ([playerId, playerIndex]) => ({
        playerId,
        playerIndex,
      }),
    );
  }

  isGameEnded(): boolean {
    return this.gameEnded;
  }

  cleanup(): void {
    this.log.info('Cleaning up...');

    // Clean up countdown interval
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    // Clean up fallback timer
    this.clearFallbackTimer();

    // Clean up user-game mappings
    for (const userId of this.playerMapping.keys()) {
      removeUserFromGame(userId);
    }

    this.playerQueues.clear();
    this.gameEnded = true;
  }
}
