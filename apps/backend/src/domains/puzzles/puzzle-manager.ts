import { RoomId, UserId } from '@kernel/ids';

import type { GameState, BoardState, Coord, Direction, Movement } from '@core/types';
import { Board } from '@core/board';
import { processStep as coreProcessStep } from '@core/step-processor';
import type { MoveEvent } from '@core/replay/types';
import {
  createBestStartPuzzle,
  isBestStartComplete,
  scoreBestStart,
  type BestStartConfig,
} from '@core/puzzles/best-start';

import { createScopedLogger } from '@/utils/scoped-logger';
import { buildPuzzleRoomId } from '@/domains/puzzles/utils';
import { puzzlesWsEffects } from '@/domains/puzzles/ws-effects';

const MAX_QUEUED_MOVES = 200;

class PuzzleManager {
  private gameState: GameState;
  private config: BestStartConfig;
  private moveQueue: Movement[] = [];
  private tickTimer: NodeJS.Timeout | null = null;
  private started: boolean = false;
  private ended: boolean = false;
  private userId: UserId;
  private roomId: RoomId;
  private log = createScopedLogger(() => `PuzzleManager user=${this.userId}`);

  constructor(userId: UserId, config: BestStartConfig) {
    this.userId = userId;
    this.config = config;
    this.roomId = buildPuzzleRoomId(userId);
    this.gameState = createBestStartPuzzle(config);
    this.log.debug('Created puzzle');
  }

  start(): void {
    if (this.started) {
      this.log.info('Puzzle already started');
      return;
    }

    this.started = true;
    this.log.debug('Starting puzzle');

    // Broadcast initial state
    this.broadcastState();

    // Start tick timer
    this.tickTimer = setInterval(() => {
      this.tick();
    }, this.config.timing.tickRateMs);
  }

  stop(): void {
    this.log.debug('Stopping puzzle');
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.ended = true;
  }

  private tick(): void {
    if (this.ended) return;

    const step = this.gameState.tick + 1;

    // Build move event from queue (take first move if any)
    const eventsForStep: MoveEvent[] = [];
    if (this.moveQueue.length > 0) {
      const move = this.moveQueue.shift()!;
      eventsForStep.push({
        step,
        playerIndex: 0, // Always player 0 for puzzles
        sourceCoord: move.sourceCoord,
        direction: move.direction,
      });
    }

    // Process step
    coreProcessStep(this.gameState.board, step, eventsForStep, this.config.timing);
    this.gameState.tick = step;

    // Check if puzzle is complete
    if (isBestStartComplete(step, this.config)) {
      this.handlePuzzleEnd();
      return;
    }

    // Broadcast state update
    this.broadcastState();
  }

  private handlePuzzleEnd(): void {
    this.log.info('Puzzle complete');
    this.ended = true;

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    const result = scoreBestStart(this.gameState.board);
    puzzlesWsEffects.broadcastPuzzleEnd(this.roomId, this.gameState.board, result);
  }

  private broadcastState(): void {
    puzzlesWsEffects.broadcastPuzzleState(
      this.roomId,
      this.gameState.tick,
      this.gameState.board,
      this.moveQueue,
    );
  }

  queueMove(source: Coord, direction: Direction): void {
    if (this.ended) return;

    // Basic validation at queue time - only check bounds, not ownership
    // (matches gameplay behavior - allows queueing moves that will become valid)
    if (!Board.isCoordValid(this.gameState.board, source)) {
      this.log.debug(`Invalid coords ${source.x},${source.y}`);
      return;
    }

    if (this.moveQueue.length >= MAX_QUEUED_MOVES) {
      this.log.debug('Move queue full');
      return;
    }

    this.moveQueue.push({ sourceCoord: source, direction });
  }

  clearMoves(): void {
    this.moveQueue = [];
  }

  undoMove(): void {
    this.moveQueue.pop();
  }

  isEnded(): boolean {
    return this.ended;
  }

  getRoomId(): RoomId {
    return this.roomId;
  }
}

export { PuzzleManager };
