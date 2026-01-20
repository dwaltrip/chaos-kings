import { RoomId, UserId } from '@kernel/ids';

import { Direction, Coord, PlayerIndex, CorePlayerStatus } from '@core/types';
import type { GameState } from '@core/types';
import { GameStatus } from '@core/game/types';
import { Board } from '@core/board';
import type { GameConfig } from '@core/game-config';
import {
  GAME_START_TIMEOUT_MS,
  ONE_SECOND_MS,
  PRE_GAME_COUNTDOWN_SECONDS,
} from '@core/ui-timing-config';
import { processStep as coreProcessStep, createGameState } from '@core/step-processor';
import type { MoveEvent } from '@core/replay/types';

import { buildGameRoomId } from '@platform/domains/gameplay/helpers';
import type { PlayerStats } from '@platform/domains/gameplay/types';
import type { GameWithPlayers } from '@platform/domains/games/types';

import { createScopedLogger } from '@/utils/scoped-logger';
import { Timeout, Interval } from '@/utils/timers';
import { runInContextWithTransaction } from '@/context/app-context';

import { gameRepository } from '@/domains/games/game-repository';
import { getGame, endGame } from '@/domains/games/actions';
import { gameplayWsEffects } from '@/domains/gameplay/ws-effects';
import { MoveHistoryBuffer } from '@/domains/gameplay/move-history-buffer';

const MAX_QUEUED_MOVES_PER_PLAYER = 200;

interface QueuedMove {
  sourceCoord: Coord;
  movement: Direction;
}

export class GameServer {
  // TODO: Player type uses plain numbers for user_id/game_id instead of branded types
  private game: GameWithPlayers;
  private gameState: GameState;
  private playerQueues: Map<PlayerIndex, QueuedMove[]> = new Map();
  private roomName: RoomId;
  private expectedPlayers: Set<UserId>; // players expected to join this game
  private connectedPlayers: Set<UserId> = new Set(); // userIds who joined gameplay room
  private gameStarted: boolean = false;
  private gameEnded: boolean = false;
  private initialized: boolean = false;
  private countdownSeconds: number = PRE_GAME_COUNTDOWN_SECONDS;
  private startTimeout = new Timeout();
  private countdownInterval = new Interval();
  private moveFlushInterval = new Interval();
  private moveHistory = new MoveHistoryBuffer();
  private log = createScopedLogger(() => `GameServer id=${this.game.id}`);

  constructor(game: GameWithPlayers) {
    this.game = game;
    this.roomName = buildGameRoomId(this.game.id);
    this.log.debug('New GameServer');

    // Setup expected players and move queues
    this.expectedPlayers = new Set(game.players.map((p) => UserId(p.user_id)));
    for (const player of game.players) {
      this.playerQueues.set(player.player_index, []);
    }

    this.initialized = true;

    // Cancel game if not enough players join within timeout
    this.startTimeout.start(() => this.handleStartTimeout(), GAME_START_TIMEOUT_MS);

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

  async tick(): Promise<boolean> {
    // --------------------------------------------------------------------
    // TODO: Improve the flow of the entire game startup process...
    // TODO: shouldn't check both of these, should have 1 source of truth
    // --------------------------------------------------------------------
    // Don't tick if game not started / countdown is still active
    if (this.countdownInterval.isActive() || !this.gameStarted) {
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

  queueMove(playerIndex: PlayerIndex, source: Coord, movement: Direction): void {
    const playerState = this.gameState.players[playerIndex];
    if (playerState.status !== CorePlayerStatus.ACTIVE) {
      this.log.debug(`Ignoring move from inactive player ${playerIndex}`);
      return;
    }
    const queue = this.getPlayerQueue(playerIndex);

    // Basic validation at queue time - only check bounds, not ownership
    if (!Board.isCoordValid(this.gameState.board, source)) {
      this.log.error(
        `Invalid coords ${source.x},${source.y} for move request from player ${playerIndex}`,
      );
      return;
    }

    if (queue.length >= MAX_QUEUED_MOVES_PER_PLAYER) {
      this.log.info(
        `Move queue full for player ${playerIndex} (${queue.length} moves), skipping.`,
      );
      return;
    }

    const queuedMove: QueuedMove = { sourceCoord: source, movement };
    queue.push(queuedMove);
  }

  clearMoves(playerIndex: PlayerIndex): void {
    const queue = this.getPlayerQueue(playerIndex);
    queue.length = 0;
    this.log.debug(`Cleared move queue for player ${playerIndex}`);
  }

  undoMove(playerIndex: PlayerIndex): void {
    const queue = this.getPlayerQueue(playerIndex);
    if (queue.length === 0) return;
    queue.pop();
  }

  onPlayerJoinedRoom(userId: UserId): void {
    // Validation that user is in this game is done by the action via GameCoordinator
    this.connectedPlayers.add(userId);
    const playerCountStr = `${this.connectedPlayers.size}/${this.expectedPlayers.size}`;
    this.log.debug(`Player ${userId} joined game room (${playerCountStr})`);

    // Start countdown when we have enough players
    if (
      this.connectedPlayers.size >= Math.min(2, this.expectedPlayers.size) &&
      !this.countdownInterval.isActive() &&
      !this.gameStarted
    ) {
      this.startTimeout.cancel();
      this.startCountdown();
    }
  }

  private handleStartTimeout(): void {
    void runInContextWithTransaction(async () => {
      if (this.countdownInterval.isActive() || this.gameStarted || this.gameEnded) {
        return;
      }

      if (this.connectedPlayers.size >= 2) {
        // Enough players connected, start the game
        this.startCountdown();
      } else {
        // Not enough players, cancel the game
        await this.handleFailedToStart();
      }
    });
  }

  private async handleFailedToStart(): Promise<void> {
    this.log.info(
      `Game failed to start: only ${this.connectedPlayers.size} player(s) connected`,
    );
    this.gameEnded = true;

    await gameRepository.updateStatus(this.game.id, GameStatus.FAILED_TO_START);

    // TODO: broadcast failure to connected players

    this.cleanup();
  }

  startCountdown(): void {
    if (this.countdownInterval.isActive() || this.gameStarted || !this.initialized) {
      return;
    }

    this.log.debug('Starting countdown for game');
    this.broadcastGameStarting();

    this.countdownInterval.start(() => {
      void runInContextWithTransaction(async () => {
        this.countdownSeconds--;

        if (this.countdownSeconds <= 0) {
          this.countdownInterval.cancel();
          await this.startGame();
        } else {
          this.broadcastGameStarting();
        }
      });
    }, ONE_SECOND_MS);
  }

  private broadcastGameStarting(): void {
    try {
      gameplayWsEffects.broadcastGameStarting(
        this.roomName,
        this.game.id,
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
      await gameRepository.updateStatus(this.game.id, GameStatus.IN_PROGRESS);

      // Get the updated game object with new status
      const updatedGame = await getGame(this.game.id);
      if (!updatedGame) {
        throw new Error(`Game ${this.game.id} not found after starting`);
      }
      await this.broadcastGameStart(updatedGame);
      this.startMoveFlushInterval();
    } catch (error) {
      this.log.error(`Failed to update game status for game. Error:`, error);
    }
  }

  private async broadcastGameStart(game: GameWithPlayers): Promise<void> {
    try {
      gameplayWsEffects.broadcastGameStarted(
        this.roomName,
        this.game.id,
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

    this.startTimeout.cancel();
    this.countdownInterval.cancel();
    this.moveFlushInterval.cancel();

    // User session cleanup is handled by GameCoordinator.removeGame

    void this.flushMoveHistory(true);
    this.playerQueues.clear();
    this.gameEnded = true;
  }

  // ------------------- Move history flush helpers -------------------
  private startMoveFlushInterval(): void {
    if (this.moveFlushInterval.isActive()) return;
    this.moveFlushInterval.start(() => {
      void runInContextWithTransaction(async () => {
        await this.flushMoveHistory();
      });
    }, 1000);
  }

  private async flushMoveHistory(force: boolean = false): Promise<void> {
    try {
      await this.moveHistory.flush(
        (history) => gameRepository.updateMoveHistory(this.game.id, history),
        force,
      );
    } catch (error) {
      this.log.error('Failed to flush move history', error);
    }
  }
}
