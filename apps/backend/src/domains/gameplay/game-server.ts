import { GameId, RoomId, UserId } from '@kernel/ids';

import { Direction, Coord, PlayerIndex, CorePlayerStatus } from '@core/types';
import type { GameState } from '@core/types';
import { GameStatus } from '@core/game/types';
import { Board } from '@core/board';
import type { GameConfig } from '@core/game-config';
import {
  FALLBACK_TIMER_MS,
  ONE_SECOND_MS,
  PRE_GAME_COUNTDOWN_SECONDS,
} from '@core/ui-timing-config';
import { processStep as coreProcessStep, createGameState } from '@core/step-processor';
import type { MoveEvent } from '@core/replay/types';

import { buildGameRoomId } from '@platform/domains/gameplay/helpers';
import type { PlayerStats } from '@platform/domains/gameplay/types';
import type { GameWithPlayers } from '@platform/domains/games/types';

import { createScopedLogger } from '@/utils/scoped-logger';
import { runInContextWithTransaction } from '@/context/app-context';

import { gameRepository } from '@/domains/games/game-repository';
import { getGame, endGame } from '@/domains/games/actions';
import { gameplayWsEffects } from '@/domains/gameplay/ws-effects';
import { MoveHistoryBuffer } from '@/domains/gameplay/move-history-buffer';
import { removeUserFromGame } from '@/domains/gameplay/actions';

const MAX_QUEUED_MOVES_PER_PLAYER = 200;

interface QueuedMove {
  sourceCoord: Coord;
  movement: Direction;
}

export class GameServer {
  // TODO: GameWithPlayers doesn't have proper app types, e.g. GameId, UserId, etc
  // it's more of a plain data object from the DB layer
  private game: GameWithPlayers;
  private gameState: GameState;
  private playerQueues: Map<PlayerIndex, QueuedMove[]> = new Map();
  private roomName: RoomId;
  private playerMapping: Map<UserId, PlayerIndex> = new Map(); // userId -> playerIndex
  private connectedPlayers: Set<UserId> = new Set(); // userIds who joined gameplay room
  private gameStarted: boolean = false;
  private gameEnded: boolean = false;
  private initialized: boolean = false;
  private countdownActive: boolean = false;
  private countdownSeconds: number = PRE_GAME_COUNTDOWN_SECONDS;
  private countdownInterval: NodeJS.Timeout | null = null;
  private fallbackTimer: NodeJS.Timeout | null = null;
  private moveFlushTimer: NodeJS.Timeout | null = null;
  private moveHistory = new MoveHistoryBuffer();
  private log = createScopedLogger(() => `GameServer id=${this.game.id}`);

  constructor(game: GameWithPlayers) {
    this.game = game;
    this.roomName = buildGameRoomId(GameId(this.game.id));
    this.log.debug('New GameServer');

    // setup player mappings and move queues
    for (const player of game.players) {
      this.playerMapping.set(UserId(player.user_id), player.player_index);
      this.playerQueues.set(player.player_index, []);
    }

    this.initialized = true;

    // Start fallback timer to ensure countdown starts even if not all players join
    this.startFallbackTimer();

    const board = {
      grid: game.config.startingGrid,
      size: game.config.map.size,
    };
    this.gameState = createGameState(board, game.players.length);
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
      const nextStep = this.gameState.tick + 1;
      const eventsForStep: MoveEvent[] = [];
      for (const [playerIndex, moveQueue] of this.playerQueues) {
        if (moveQueue.length === 0) continue;
        const queuedMove = moveQueue.shift()!;
        eventsForStep.push({
          step: nextStep,
          playerIndex,
          sourceCoord: queuedMove.sourceCoord,
          direction: queuedMove.movement,
        });
      }

      const { timing } = this.game.config as GameConfig;

      const { appliedEvents, gameEvents, gameEnded, winnerPlayerIndex } = coreProcessStep(
        this.gameState,
        eventsForStep,
        timing,
      );

      if (appliedEvents.length) {
        this.moveHistory.append(appliedEvents);
      }

      // Clear queues for defeated players
      for (const event of gameEvents) {
        if (event.type === 'player_defeated') {
          const queue = this.playerQueues.get(event.defeated);
          if (queue) queue.length = 0;
          this.log.info(
            `Player ${event.defeated} defeated by player ${event.capturedBy} at tick ${event.tick}`,
          );
        }
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
      const playerStats = this.getPlayerStatsForBroadcast();
      gameplayWsEffects.broadcastGameState(
        this.roomName,
        this.gameState.tick,
        this.gameState.board,
        this.getPlayerQueuesForBroadcast(),
        playerStats,
      );
    } catch (error) {
      this.log.error('Failed to broadcast game state. Error:', error);
    }
  }

  private broadcastGameEnd(winnerPlayerIndex: number): void {
    try {
      gameplayWsEffects.broadcastGameEnded(
        this.roomName,
        winnerPlayerIndex,
        this.gameState.board,
      );
    } catch (error) {
      this.log.error(`Failed to broadcast game end. Error:`, error);
    }
  }

  private getPlayerStatsForBroadcast(): PlayerStats[] {
    return this.gameState.players.map((player, index) => ({
      playerIndex: index,
      armyCount: player.armyCount,
      landCount: player.landCount,
    }));
  }

  queueMove(userId: UserId, source: Coord, movement: Direction): void {
    const playerIndex = this.playerMapping.get(userId);
    if (playerIndex === undefined) {
      this.log.info(`Move request from unknown user ${userId}`);
      return;
    }
    const playerState = this.gameState.players[playerIndex];
    if (playerState.status !== CorePlayerStatus.ACTIVE) {
      this.log.debug(
        `Ignoring move from inactive player ${playerIndex} (user ${userId})`,
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
      this.log.error(
        `User ${userId} not part of game, ignoring join. Expected players: ${[...this.playerMapping.keys()].join(', ')}`,
      );
      return;
    }

    this.connectedPlayers.add(userId);
    const playerCountStr = `${this.connectedPlayers.size}/${this.game.players.length}`;
    this.log.debug(`Player ${userId} joined game room (${playerCountStr})`);

    // Start countdown when we have enough players (or at least 1)
    if (
      this.connectedPlayers.size >= Math.min(2, this.game.players.length) &&
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
      void runInContextWithTransaction(async () => {
        if (!this.countdownActive && !this.gameStarted) {
          if (this.connectedPlayers.size >= 2) {
            this.log.error(
              `Fallback countdown with ${this.connectedPlayers.size} players`,
            );
            this.startCountdown();
          } else {
            // Not enough players, keep waiting (alpha behavior)
            this.log.info(
              `Fallback skipped; waiting for at least 2 players (currently ${this.connectedPlayers.size})`,
            );
            this.startFallbackTimer();
          }
        }
      });
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
      void runInContextWithTransaction(async () => {
        this.countdownSeconds--;

        if (this.countdownSeconds <= 0) {
          await this.finishCountdown();
        } else {
          this.broadcastGameStarting();
        }
      });
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
      // TODO: these IDs should already be of type GameId / RoomId
      gameplayWsEffects.broadcastGameStarting(
        this.roomName,
        GameId(this.game.id),
        this.countdownSeconds,
      );
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
      await gameRepository.updateStatus(GameId(this.game.id), GameStatus.IN_PROGRESS);

      // Get the updated game object with new status
      const updatedGame = await getGame(GameId(this.game.id));
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
      gameplayWsEffects.broadcastGameStarted(
        this.roomName,
        GameId(this.game.id),
        this.gameState.board,
        game,
      );
    } catch (error) {
      this.log.error(`Failed to broadcast game start`, error);
    }
  }

  getRoomName() {
    return this.roomName;
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
      void runInContextWithTransaction(async () => {
        await this.flushMoveHistory();
      });
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
      await this.moveHistory.flush(
        (history) => gameRepository.updateMoveHistory(GameId(this.game.id), history),
        force,
      );
    } catch (error) {
      this.log.error('Failed to flush move history', error);
    }
  }
}
