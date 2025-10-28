import { UserId } from '@core/db-types';
import { GameState, BoardState, Direction, Coord, PlayerIndex } from '@core/types';
import { Board } from '@core/board';
import type { GameConfig } from '@core/game-config';
import {
  FALLBACK_TIMER_MS,
  ONE_SECOND_MS,
  PRE_GAME_COUNTDOWN_SECONDS,
} from '@core/ui-timing-config';
import { processStep as coreProcessStep } from '@core/step-processor';
import type { MoveEvent } from '@core/replay/types';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';
import { roomKey } from '@common/utils/room-key';
import type { GameWithPlayers } from '@common/types/games';

import { getGame } from '@/game/actions/get-game';
import { createScopedLogger } from '@/utils/scoped-logger';
import { getGlobalWebSocketManager } from '@/websocket/global-manager';
import { removeUserFromGame } from '@/gameplay/gameplay-ws-api';
import { GameRepository } from '@/game/game-repository';
import { GameStatus } from '@/game/types';
import { endGame } from '@/game/actions/end-game';
import { MoveHistoryBuffer } from '@/gameplay/move-history-buffer';

const MAX_QUEUED_MOVES_PER_PLAYER = 200;

interface QueuedMove {
  sourceCoord: Coord;
  movement: Direction;
}

export class GameServer {
  private game: GameWithPlayers;
  private gameState: GameState;
  private playerQueues: Map<PlayerIndex, QueuedMove[]> = new Map();
  private roomName: string;
  private playerMapping: Map<UserId, PlayerIndex> = new Map(); // userId -> playerIndex
  private connectedPlayers: Set<UserId> = new Set(); // userIds who joined gameplay room
  private expectedPlayerCount: number = 0;
  private gameStarted: boolean = false;
  private gameEnded: boolean = false;
  private initialized: boolean = false;
  private countdownActive: boolean = false;
  private countdownSeconds: number = PRE_GAME_COUNTDOWN_SECONDS;
  private countdownInterval: NodeJS.Timeout | null = null;
  private fallbackTimer: NodeJS.Timeout | null = null;
  private moveFlushTimer: NodeJS.Timeout | null = null;
  private moveHistory = new MoveHistoryBuffer();
  private defeatedPlayers: Set<number> = new Set();
  private log = createScopedLogger(() => `GameServer id=${this.game.id}`);

  constructor(game: GameWithPlayers) {
    this.game = game;
    this.roomName = roomKey(GAMEPLAY_DOMAIN, `game-${this.game.id}`);
    this.log.debug('New GameServer');

    // setup player mappings and move queues
    game.players.forEach((player, playerIndex) => {
      this.playerMapping.set(player.user_id, playerIndex);
      this.playerQueues.set(playerIndex, []);
    });

    this.expectedPlayerCount = game.players.length;
    this.initialized = true;

    // Start fallback timer to ensure countdown starts even if not all players join
    this.startFallbackTimer();

    const boardState: BoardState = {
      grid: game.config.startingGrid,
      size: game.config.map.size,
    };
    this.gameState = {
      board: boardState,
      tick: 0,
    };
    this.log.debug(`GameServer initialized with ${game.players.length} players`);
  }

  private getPlayerQueue(playerIndex: PlayerIndex): QueuedMove[] {
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
    if (!this.initialized || this.gameEnded) {
      return this.gameEnded;
    }

    try {
      // Build at most 1 event per player for the upcoming step (1-based)
      const step = this.gameState.tick + 1;
      const eventsForStep: MoveEvent[] = [];
      for (const [playerIndex, moveQueue] of this.playerQueues) {
        if (moveQueue.length === 0) continue;
        const queuedMove = moveQueue.shift()!;
        eventsForStep.push({
          step,
          playerIndex,
          sourceCoord: queuedMove.sourceCoord,
          direction: queuedMove.movement,
        });
      }

      const { timing } = this.game.config as GameConfig;

      // Capture generals pre-step to detect newly defeated players
      const generalsBefore = this.getPlayersWithGenerals(this.gameState.board);
      const { appliedEvents, gameEnded, winnerPlayerIndex } = coreProcessStep(
        this.gameState.board,
        step,
        eventsForStep,
        timing,
      );
      if (appliedEvents.length) {
        this.moveHistory.append(appliedEvents);
      }
      this.gameState.tick = step;

      // Detect players who lost their general this step
      const generalsAfter = this.getPlayersWithGenerals(this.gameState.board);
      const newlyDefeated: number[] = [];
      for (const p of generalsBefore) {
        if (!generalsAfter.has(p)) newlyDefeated.push(p);
      }
      if (newlyDefeated.length) {
        for (const p of newlyDefeated) {
          this.defeatedPlayers.add(p);
          const q = this.playerQueues.get(p);
          if (q) q.length = 0; // clear their queue
        }
        this.log.info(`Defeated players this step ${step}: ${newlyDefeated.join(', ')}`);
      }

      if (gameEnded) {
        await this.handleGameEnd(winnerPlayerIndex!);
        return true;
      }

      this.broadcastGameState();
      return false;
    } catch (error) {
      this.log.error(`Error during tick ${this.gameState.tick}:`, error);
      this.gameEnded = true;
      return true;
    }
  }

  // Movement now processed in core step-processor

  private getPlayersWithGenerals(board: BoardState): Set<number> {
    const s = new Set<number>();
    for (const row of board.grid) {
      for (const sq of row) {
        if (sq.type === 'GENERAL') s.add(sq.playerIndex);
      }
    }
    return s;
  }

  private async handleGameEnd(winnerPlayerIndex: number): Promise<void> {
    this.log.info(`Game ended, winner: player ${winnerPlayerIndex}`);
    this.gameEnded = true;

    // Update game status and save final game state to database
    await endGame({
      game: this.game,
      winnerPlayerIndex,
      finalGameState: this.gameState,
      reason: 'general_captured',
      moveHistory: this.moveHistory.buildHistory(),
    });

    this.broadcastGameEnd(winnerPlayerIndex);
  }

  private getPlayerQueuesForBroadcast(): Record<
    number,
    Array<{ sourceCoord: Coord; direction: Direction }>
  > {
    const result: Record<
      number,
      Array<{ sourceCoord: Coord; direction: Direction }>
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
    try {
      const wsManager = getGlobalWebSocketManager();
      wsManager.serverBroadcastToRoom(this.roomName, {
        domain: GAMEPLAY_DOMAIN,
        type: 'game-state-update',
        payload: {
          gameId: this.game.id,
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
    try {
      const wsManager = getGlobalWebSocketManager();
      wsManager.serverBroadcastToRoom(this.roomName, {
        domain: GAMEPLAY_DOMAIN,
        type: 'game-ended',
        payload: {
          gameId: this.game.id,
          winner: winnerPlayerIndex,
          reason: 'general_captured',
          finalBoardState: this.gameState.board,
        },
      });
    } catch (error) {
      this.log.error(`Failed to broadcast game end. Error:`, error);
    }
  }

  queueMove(userId: UserId, source: Coord, movement: Direction): void {
    const playerIndex = this.playerMapping.get(userId);
    if (playerIndex === undefined) {
      this.log.info(`Move request from unknown user ${userId}`);
      return;
    }
    if (this.defeatedPlayers.has(playerIndex)) {
      this.log.debug(
        `Ignoring move from defeated player ${playerIndex} (user ${userId})`,
      );
      return;
    }
    const queue = this.getPlayerQueue(playerIndex);

    // Basic validation at queue time - only check bounds, not ownership
    if (!Board.isCoordValid(this.gameState.board, source)) {
      this.log.error(
        `Invalid coords ${source.x},${source.y} for move request from user id=${userId}`,
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

  clearMoves(userId: UserId): void {
    const playerIndex = this.playerMapping.get(userId);
    if (playerIndex === undefined) {
      this.log.error(`Clear moves request from unknown user id=${userId}`);
      return;
    }

    const queue = this.getPlayerQueue(playerIndex);
    if (queue) {
      queue.length = 0;
      this.log.debug(`Cleared move queue for player ${playerIndex}`);
    }
  }

  undoMove(userId: UserId): void {
    const playerIndex = this.playerMapping.get(userId);
    if (playerIndex === undefined) {
      this.log.error(`Undo move request from unknown user id=${userId}`);
      return;
    }
    const queue = this.getPlayerQueue(playerIndex);
    if (!queue || queue.length === 0) {
      return;
    }
    queue.pop();
  }

  onPlayerJoinedRoom(userId: UserId): void {
    if (!this.playerMapping.has(userId)) {
      this.log.error(`User ${userId} not part of game, ignoring join`);
      return;
    }

    this.connectedPlayers.add(userId);
    const playerCountStr = `${this.connectedPlayers.size}/${this.expectedPlayerCount}`;
    this.log.debug(`Player ${userId} joined game room (${playerCountStr})`);

    // Start countdown when we have enough players (or at least 1)
    if (
      this.connectedPlayers.size >= Math.min(2, this.expectedPlayerCount) &&
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
      if (!this.countdownActive && !this.gameStarted) {
        if (this.connectedPlayers.size >= 2) {
          this.log.error(`Fallback countdown with ${this.connectedPlayers.size} players`);
          this.startCountdown();
        } else {
          // Not enough players, keep waiting (alpha behavior)
          this.log.info(
            `Fallback skipped; waiting for at least 2 players (currently ${this.connectedPlayers.size})`,
          );
          this.startFallbackTimer();
        }
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
          gameId: this.game.id,
          countdown: this.countdownSeconds,
        },
      });
    } catch (error) {
      this.log.error('Failed to broadcast game-starting. Error:', error);
    }
  }

  async startGame(): Promise<void> {
    if (this.gameStarted || !this.initialized) {
      return;
    }

    this.gameStarted = true;
    this.log.debug('Starting game');

    // Update game status to IN_PROGRESS in database
    try {
      const gameRepository = new GameRepository();
      await gameRepository.updateStatus(this.game.id, GameStatus.IN_PROGRESS);

      // Get the updated game object with new status
      const updatedGame = await getGame(this.game.id);
      if (!updatedGame) {
        throw new Error(`Game ${this.game.id} not found after starting`);
      }
      await this.broadcastGameStart(updatedGame);
      this.startMoveFlushTimer();
    } catch (error) {
      this.log.error(`Failed to update game status for game. Error:`, error);
    }
  }

  private async broadcastGameStart(game: GameWithPlayers): Promise<void> {
    try {
      const wsManager = getGlobalWebSocketManager();
      const payload: any = {
        gameId: this.game.id,
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

  getPlayerMapping(): Array<{ playerId: string; playerIndex: PlayerIndex }> {
    return Array.from(this.playerMapping.entries()).map(([userId, playerIndex]) => ({
      playerId: String(userId),
      playerIndex,
    }));
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

    // Final move-history flush on cleanup
    void this.flushMoveHistory(true);
    this.playerQueues.clear();
    this.gameEnded = true;
    this.stopMoveFlushTimer();
  }

  // ------------------- Move history flush helpers -------------------
  private startMoveFlushTimer(): void {
    if (this.moveFlushTimer) return;
    this.moveFlushTimer = setInterval(() => {
      void this.flushMoveHistory();
    }, 1000);
  }

  private stopMoveFlushTimer(): void {
    if (this.moveFlushTimer) {
      clearInterval(this.moveFlushTimer);
      this.moveFlushTimer = null;
    }
  }

  private async flushMoveHistory(force: boolean = false): Promise<void> {
    try {
      const repo = new GameRepository();
      await this.moveHistory.flush(
        (history) => repo.updateMoveHistory(this.game.id, history),
        force,
      );
    } catch (error) {
      this.log.error('Failed to flush move history', error);
    }
  }
}
