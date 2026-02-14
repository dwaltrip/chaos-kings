import { processStep } from '@core/step-processor';
import type { ProcessStepResult } from '@core/step-processor';
import type { GameState, Coord, Direction, Movement } from '@core/types';
import type { MoveEvent } from '@core/replay/types';
import type { TimingConfig } from '@core/timing/types';

interface MoveInput {
  playerIndex: number;
  sourceCoord: Coord;
  direction: Direction;
}

interface TimelineEngineConfig {
  checkpointInterval: number;
}

const DEFAULT_CONFIG: TimelineEngineConfig = {
  checkpointInterval: 25,
};

function deepCloneGameState(gameState: GameState): GameState {
  return {
    tick: gameState.tick,
    board: {
      size: { ...gameState.board.size },
      grid: gameState.board.grid.map((row) =>
        row.map((square) => ({ ...square, coord: { ...square.coord } })),
      ),
    },
    players: gameState.players.map((p) => ({ ...p })),
  };
}

class TimelineEngine {
  private initialState: GameState;
  private currentState: GameState;
  private timing: TimingConfig;
  private config: TimelineEngineConfig;

  private currentTick: number = 0;
  private maxTick: number = 0;

  // The move that was executed on the most recent tick (during normal play).
  // Cleared on timeline manipulation (jumpToTick, reset).
  private lastExecutedMove: Movement | null = null;

  // Indexed by tick. null = no moves applied at that tick.
  private moveHistory: (MoveEvent[] | null)[] = [];

  private checkpoints: Map<number, GameState> = new Map();

  constructor(
    initialState: GameState,
    timing: TimingConfig,
    config?: Partial<TimelineEngineConfig>,
  ) {
    this.initialState = deepCloneGameState(initialState);
    this.currentState = deepCloneGameState(initialState);
    this.timing = timing;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Tick-0 checkpoint
    this.checkpoints.set(0, deepCloneGameState(this.currentState));
  }

  tick(moves: MoveInput[]): ProcessStepResult {
    // Branching: if we're behind maxTick, truncate future
    if (this.currentTick < this.maxTick) {
      this.moveHistory.length = this.currentTick;
      for (const [tick] of this.checkpoints) {
        if (tick > this.currentTick) {
          this.checkpoints.delete(tick);
        }
      }
      this.maxTick = this.currentTick;
    }

    const nextStep = this.currentTick + 1;

    // Convert MoveInput[] to MoveEvent[] by assigning step
    const moveEvents: MoveEvent[] = moves.map((m) => ({
      step: nextStep,
      playerIndex: m.playerIndex,
      sourceCoord: m.sourceCoord,
      direction: m.direction,
    }));

    const result = processStep(this.currentState, moveEvents, this.timing);

    if (moves.length > 0) {
      const m = moves[0];
      this.lastExecutedMove = { sourceCoord: m.sourceCoord, direction: m.direction };
    } else {
      this.lastExecutedMove = null;
    }

    // Record only applied events
    if (result.appliedEvents.length > 0) {
      this.moveHistory.push(result.appliedEvents);
    } else {
      this.moveHistory.push(null);
    }

    this.currentTick = nextStep;
    this.maxTick = nextStep;

    // Save checkpoint at interval
    if (nextStep % this.config.checkpointInterval === 0) {
      this.checkpoints.set(nextStep, deepCloneGameState(this.currentState));
    }

    return result;
  }

  // NOTE: future optimization for forward jumps — could replay from current
  // state instead of finding checkpoint when jumping forward
  jumpToTick(target: number): void {
    if (target < 0 || target > this.maxTick) {
      throw new Error(`jumpToTick(${target}) out of range [0, ${this.maxTick}]`);
    }

    if (target === this.currentTick) {
      return;
    }

    this.lastExecutedMove = null;

    // Small forward jump: replay from current state (avoids checkpoint clone)
    if (target > this.currentTick && target - this.currentTick <= 10) {
      for (let tick = this.currentTick + 1; tick <= target; tick++) {
        const events = this.moveHistory[tick - 1] ?? [];
        processStep(this.currentState, events, this.timing);
        this.currentTick = tick;
      }
      return;
    }

    // Find nearest checkpoint at or before target
    let checkpointTick = 0;
    for (const [tick] of this.checkpoints) {
      if (tick <= target && tick > checkpointTick) {
        checkpointTick = tick;
      }
    }

    // Restore from checkpoint
    this.currentState = deepCloneGameState(this.checkpoints.get(checkpointTick)!);
    this.currentTick = checkpointTick;

    // Replay from checkpoint to target
    for (let tick = checkpointTick + 1; tick <= target; tick++) {
      const events = this.moveHistory[tick - 1] ?? [];
      processStep(this.currentState, events, this.timing);
      this.currentTick = tick;
    }
  }

  reset(): void {
    this.currentState = deepCloneGameState(this.initialState);
    this.currentTick = 0;
    this.maxTick = 0;
    this.lastExecutedMove = null;
    this.moveHistory = [];
    this.checkpoints.clear();
    this.checkpoints.set(0, deepCloneGameState(this.currentState));
  }

  // TODO: Readonly<GameState> is zero-cost type safety but doesn't protect
  // against stale references. If the caller holds a ref across ticks, the
  // underlying object has been mutated by processStep. Current usage is all
  // inline reads (broadcast, validation) so this is fine. If we hit bugs
  // from stale refs, consider adding a snapshotState() that clones.
  getState(): Readonly<GameState> {
    return this.currentState;
  }

  getCurrentTick(): number {
    return this.currentTick;
  }

  getMaxTick(): number {
    return this.maxTick;
  }

  getLastExecutedMove(): Movement | null {
    return this.lastExecutedMove;
  }

  // loadHistory(events: MoveEvent[]): void {
  //   // Future: populate history from saved replay data without ticking.
  //   // Enables replay viewer to load a completed game and scrub through it.
  // }
}

export type { MoveInput, TimelineEngineConfig, ProcessStepResult };
export { TimelineEngine, deepCloneGameState };
