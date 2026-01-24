import { idToNumber } from '@kernel/branded-type';
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

import { runInContextWithTransaction } from '@/context/app-context';
import { createScopedLogger } from '@/utils/scoped-logger';
import { puzzleAttemptRepository } from '@/domains/puzzles/puzzle-attempt-repository';
import { buildPuzzleRoomId } from '@/domains/puzzles/utils';
import { puzzlesWsEffects } from '@/domains/puzzles/ws-effects';

const MAX_QUEUED_MOVES = 200;

class PuzzleManager {
  private gameState: GameState;
  private config: BestStartConfig;
  private seed: number;
  private moveQueue: Movement[] = [];
  private executedMoves: Movement[] = [];
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
    const result = createBestStartPuzzle(config);
    this.gameState = result.gameState;
    this.seed = result.seed;
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

    const nextStep = this.gameState.tick + 1;

    // -------------------------------------------------------------------------
    // TODO: Consider adding "grace" - if a queued move is invalid, keep trying
    // subsequent moves in the queue until a valid one is found (or queue empty).
    // Currently, an invalid move "wastes" the tick with no movement applied.
    // -------------------------------------------------------------------------

    // Build move event from queue (take first move if any)
    const eventsForStep: MoveEvent[] = [];
    let pendingMove: Movement | null = null;
    if (this.moveQueue.length > 0) {
      pendingMove = this.moveQueue.shift()!;
      eventsForStep.push({
        step: nextStep,
        playerIndex: 0, // Always player 0 for puzzles
        sourceCoord: pendingMove.sourceCoord,
        direction: pendingMove.direction,
      });
    }

    // Process step (updates gameState.tick internally)
    const { appliedEvents } = coreProcessStep(
      this.gameState,
      eventsForStep,
      this.config.timing,
    );

    // Only track moves that were actually applied
    if (pendingMove && appliedEvents.length > 0) {
      this.executedMoves.push(pendingMove);
    }

    // Check if puzzle is complete
    if (isBestStartComplete(this.gameState.tick, this.config)) {
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
    puzzlesWsEffects.broadcastPuzzleEnd(
      this.roomId,
      this.gameState.tick,
      this.gameState.board,
      result,
    );

    // Save attempt to database
    void runInContextWithTransaction(async () => {
      await puzzleAttemptRepository.create({
        user_id: idToNumber(this.userId),
        puzzle_type: 'best_start',
        land_count: result.landCount,
        army_count: result.armyCount,
        config: this.config,
        map_seed: this.seed,
        final_board_state: this.gameState.board,
        move_history: { version: 1, moves: this.executedMoves },
      });
      this.log.debug('Saved puzzle attempt');
    });
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
}

export { PuzzleManager };
