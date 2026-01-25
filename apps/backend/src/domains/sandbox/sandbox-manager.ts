import { RoomId, UserId } from '@kernel/ids';

import type { GameState, BoardState, Coord, Direction, Movement } from '@core/types';
import { processStep as coreProcessStep, createGameState } from '@core/step-processor';
import { generateGameMapV2 } from '@core/terrain-generation';
import type { MoveEvent } from '@core/replay/types';
import { MoveQueueEngine } from '@core/move-queue';

import { createScopedLogger } from '@/utils/scoped-logger';
import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';
import type { SandboxConfig } from '@/domains/sandbox/types';

interface GameStateSnapshot {
  gameState: GameState;
  tick: number;
}

function deepCloneGameState(gameState: GameState): GameState {
  return {
    tick: gameState.tick,
    players: gameState.players.map((p) => ({ ...p })),
    board: {
      size: { ...gameState.board.size },
      grid: gameState.board.grid.map((row) =>
        row.map((sq) => ({
          ...sq,
          coord: { ...sq.coord },
        })),
      ),
    },
  };
}

class SandboxManager {
  private gameState: GameState;
  private initialGameState: GameState;
  private moveQueue: MoveQueueEngine;
  private checkpoints: Map<number, GameStateSnapshot> = new Map();
  private tickTimer: NodeJS.Timeout | null = null;
  private isPaused: boolean = true;
  private userId: UserId;
  private roomId: RoomId;
  private config: SandboxConfig;
  private seed: number;
  private log = createScopedLogger(() => `SandboxManager user=${this.userId}`);

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
    this.gameState = createGameState(board, 1);
    this.initialGameState = deepCloneGameState(this.gameState);
    this.moveQueue = new MoveQueueEngine();

    this.saveCheckpoint();
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
      this.tick();
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

    this.tick();
    this.broadcastState();
  }

  stepBack(): void {
    if (!this.isPaused) return;

    const targetTick = Math.max(0, this.gameState.tick - 1);
    this.rewindToTick(targetTick);
  }

  rewindToTick(targetTick: number): void {
    if (targetTick < 0) return;
    if (targetTick > this.gameState.tick) return;

    this.log.debug(`Rewinding to tick ${targetTick}`);

    let checkpointTick = 0;
    for (const tick of this.checkpoints.keys()) {
      if (tick <= targetTick && tick > checkpointTick) {
        checkpointTick = tick;
      }
    }

    const checkpoint = this.checkpoints.get(checkpointTick);
    if (!checkpoint) {
      this.log.warn(`No checkpoint found for tick ${checkpointTick}`);
      return;
    }

    this.gameState = deepCloneGameState(checkpoint.gameState);

    while (this.gameState.tick < targetTick) {
      this.tickInternal(false);
    }

    this.moveQueue.clearMoves();
    this.broadcastState();
  }

  reset(): void {
    this.log.debug('Resetting to tick 0');

    if (!this.isPaused) {
      this.pause();
    }

    this.gameState = deepCloneGameState(this.initialGameState);
    this.moveQueue.clearMoves();
    this.checkpoints.clear();
    this.saveCheckpoint();

    this.broadcastState();
  }

  queueMove(source: Coord, direction: Direction): void {
    const success = this.moveQueue.queueMove(source, direction, this.gameState.board);
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
    return {
      tick: this.gameState.tick,
      board: this.gameState.board,
      queue: this.moveQueue.getQueue(),
      isPaused: this.isPaused,
    };
  }

  getConfig(): SandboxConfig {
    return this.config;
  }

  private tick(): void {
    this.tickInternal(true);
  }

  private tickInternal(saveCheckpoint: boolean): void {
    const nextStep = this.gameState.tick + 1;

    const eventsForStep: MoveEvent[] = [];
    if (!this.moveQueue.isEmpty()) {
      const pendingMove = this.moveQueue.shiftMove()!;
      eventsForStep.push({
        step: nextStep,
        playerIndex: 0,
        sourceCoord: pendingMove.sourceCoord,
        direction: pendingMove.direction,
      });
    }

    coreProcessStep(this.gameState, eventsForStep, this.config.timing);

    if (saveCheckpoint) {
      this.maybeSaveCheckpoint();
    }
  }

  private maybeSaveCheckpoint(): void {
    if (this.gameState.tick % this.config.checkpointInterval === 0) {
      this.saveCheckpoint();
    }
  }

  private saveCheckpoint(): void {
    const snapshot: GameStateSnapshot = {
      gameState: deepCloneGameState(this.gameState),
      tick: this.gameState.tick,
    };
    this.checkpoints.set(this.gameState.tick, snapshot);
  }

  private broadcastSessionStarted(): void {
    sandboxWsEffects.broadcastSessionStarted(this.roomId, this.gameState.board, {
      mapSize: this.config.mapSize,
      timing: this.config.timing,
      checkpointInterval: this.config.checkpointInterval,
    });
  }

  private broadcastState(): void {
    sandboxWsEffects.broadcastStateUpdate(
      this.roomId,
      this.gameState.tick,
      this.gameState.board,
      this.moveQueue.getQueue(),
      this.isPaused,
    );
  }
}

export { SandboxManager };
