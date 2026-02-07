import { RoomId, UserId } from '@kernel/ids';

import type { GameState, Coord, Direction, Movement } from '@core/types';
import { createGameState } from '@core/step-processor';
import { generateGameMapV2 } from '@core/terrain-generation';
import { MoveQueueEngine } from '@core/move-queue';
import { TimelineEngine } from '@core/timeline';
import type { MoveInput } from '@core/timeline';

import { createScopedLogger } from '@/utils/scoped-logger';
import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';
import type { SandboxConfig } from '@/domains/sandbox/types';

class SandboxSession {
  private timeline: TimelineEngine;
  private moveQueue: MoveQueueEngine;
  private tickTimer: NodeJS.Timeout | null = null;
  private isPaused: boolean = true;
  private userId: UserId;
  private roomId: RoomId;
  private config: SandboxConfig;
  private seed: number;
  private log = createScopedLogger(() => `SandboxSession user=${this.userId}`);

  constructor(userId: UserId, roomId: RoomId, config: SandboxConfig) {
    this.userId = userId;
    this.roomId = roomId;
    this.config = config;
    this.seed = config.seed ?? Date.now();

    const { width, height } = config.mapSize;
    const { grid } = generateGameMapV2({
      size: { width, height },
      numPlayers: 1,
      minGeneralDistance: 0,
      seed: this.seed,
    });

    const board = { grid, size: { width, height } };
    const initialState = createGameState(board, 1);

    this.timeline = new TimelineEngine(initialState, config.timing, {
      checkpointInterval: config.checkpointInterval,
    });
    this.moveQueue = new MoveQueueEngine();

    this.log.debug('Created sandbox');
  }

  start(): void {
    this.log.debug('Starting sandbox (paused)');
    this.broadcastSessionStarted();
    this.broadcastState();
  }

  stop(): void {
    this.log.debug('Stopping sandbox');
    this.pause();
  }

  play(): void {
    if (!this.isPaused) return;

    this.isPaused = false;
    this.log.debug('Playing');

    this.tickTimer = setInterval(() => {
      this.doTick();
      this.broadcastState();
    }, this.config.timing.tickRateMs);

    this.broadcastState();
  }

  pause(): void {
    if (this.isPaused) return;

    this.isPaused = true;
    this.log.debug('Paused');

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    this.broadcastState();
  }

  stepForward(): void {
    if (!this.isPaused) return;

    this.doTick();
    this.broadcastState();
  }

  stepBack(): void {
    if (!this.isPaused) return;

    const targetTick = Math.max(0, this.timeline.getCurrentTick() - 1);
    this.jumpToTick(targetTick);
  }

  jumpToTick(targetTick: number): void {
    this.log.debug(`Jumping to tick ${targetTick}`);
    this.moveQueue.clearMoves();
    this.timeline.jumpToTick(targetTick);
    this.broadcastState();
  }

  reset(): void {
    this.log.debug('Resetting to tick 0');

    if (!this.isPaused) {
      this.pause();
    }

    this.timeline.reset();
    this.moveQueue.clearMoves();
    this.broadcastState();
  }

  queueMove(source: Coord, direction: Direction): void {
    const state = this.timeline.getState();
    const success = this.moveQueue.queueMove(source, direction, state.board);
    if (success) {
      this.broadcastState();
    }
  }

  undoMove(): void {
    this.moveQueue.undoMove();
    this.broadcastState();
  }

  clearMoves(): void {
    this.moveQueue.clearMoves();
    this.broadcastState();
  }

  getState() {
    const state = this.timeline.getState();
    return {
      tick: state.tick,
      board: state.board,
      queue: this.moveQueue.getQueue(),
      isPaused: this.isPaused,
      maxTickReached: this.timeline.getMaxTick(),
    };
  }

  getConfig(): SandboxConfig {
    return this.config;
  }

  private doTick(): void {
    const moves: MoveInput[] = [];
    if (!this.moveQueue.isEmpty()) {
      const pendingMove = this.moveQueue.shiftMove()!;
      moves.push({
        playerIndex: 0,
        sourceCoord: pendingMove.sourceCoord,
        direction: pendingMove.direction,
      });
    }

    this.timeline.tick(moves);
  }

  private broadcastSessionStarted(): void {
    const state = this.timeline.getState();
    sandboxWsEffects.broadcastSessionStarted(this.roomId, state.board, {
      mapSize: this.config.mapSize,
      timing: this.config.timing,
      checkpointInterval: this.config.checkpointInterval,
    });
  }

  private broadcastState(): void {
    const state = this.timeline.getState();
    sandboxWsEffects.broadcastStateUpdate(
      this.roomId,
      state.tick,
      state.board,
      this.moveQueue.getQueue(),
      this.isPaused,
      this.timeline.getMaxTick(),
    );
  }
}

export { SandboxSession };
