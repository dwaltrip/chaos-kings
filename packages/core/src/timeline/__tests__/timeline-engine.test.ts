import { createGameState } from '@core/step-processor';
import { Direction, PlayerSquareType, NeutralSquareType } from '@core/types';
import type { BoardState, Coord, Square, GameState, PlayerSquare } from '@core/types';
import type { TimingConfig } from '@core/timing/types';

import { deepCloneGameState } from '@core/utils/clone-utils';
import { TimelineEngine } from '../timeline-engine';
import type { MoveInput } from '../timeline-engine';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// Production never fires during small test scenarios (< 1000 ticks).
const QUIET_TIMING: TimingConfig = {
  tickRateMs: 500,
  generalProductionTicks: 1000,
  landProductionTicks: 2000,
};

const FAST_PRODUCTION_TIMING: TimingConfig = {
  tickRateMs: 500,
  generalProductionTicks: 2,
  landProductionTicks: 50,
};

function makeBoard(width: number, height: number): BoardState {
  const grid: Square[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Square[] = [];
    for (let x = 0; x < width; x++) {
      row.push({ type: NeutralSquareType.BLANK, coord: { x, y } });
    }
    grid.push(row);
  }
  return { grid, size: { width, height } };
}

function placeGeneral(
  board: BoardState,
  coord: Coord,
  playerIndex: number,
  units = 1,
): void {
  board.grid[coord.y][coord.x] = {
    type: PlayerSquareType.GENERAL,
    coord,
    playerIndex,
    units,
  };
}

function placeArmy(
  board: BoardState,
  coord: Coord,
  playerIndex: number,
  units = 1,
): void {
  board.grid[coord.y][coord.x] = {
    type: PlayerSquareType.ARMY,
    coord,
    playerIndex,
    units,
  };
}

function placeMountain(board: BoardState, coord: Coord): void {
  board.grid[coord.y][coord.x] = {
    type: NeutralSquareType.MOUNTAIN,
    coord,
  };
}

function getSquare(state: GameState, coord: Coord): Square {
  return state.board.grid[coord.y][coord.x];
}

function getUnits(state: GameState, coord: Coord): number {
  const square = getSquare(state, coord);
  if ('units' in square) return (square as PlayerSquare).units;
  throw new Error(`Square at ${coord.x},${coord.y} has no units`);
}

function getOwner(state: GameState, coord: Coord): number {
  const square = getSquare(state, coord);
  if ('playerIndex' in square) return (square as PlayerSquare).playerIndex;
  throw new Error(`Square at ${coord.x},${coord.y} has no owner`);
}

/**
 * Create a standard 5x5 test board:
 *   - Player 0 general at (0,0) with `p0Units` (default 10)
 *   - Player 1 general at (4,4) with `p1Units` (default 10)
 *   - Everything else is blank
 */
function makeTestBoard(p0Units = 10, p1Units = 10): BoardState {
  const board = makeBoard(5, 5);
  placeGeneral(board, { x: 0, y: 0 }, 0, p0Units);
  placeGeneral(board, { x: 4, y: 4 }, 1, p1Units);
  return board;
}

function makeTestGameState(p0Units = 10, p1Units = 10): GameState {
  return createGameState(makeTestBoard(p0Units, p1Units), 2);
}

function makeEngine(
  gameState?: GameState,
  timing?: TimingConfig,
  config?: Partial<{ checkpointInterval: number }>,
): TimelineEngine {
  return new TimelineEngine(
    gameState ?? makeTestGameState(),
    timing ?? QUIET_TIMING,
    config,
  );
}

/** Advance the engine N ticks with no moves. */
function tickN(engine: TimelineEngine, n: number): void {
  for (let i = 0; i < n; i++) {
    engine.tick([]);
  }
}

/** Capture a deep snapshot of the engine's current state for later comparison. */
function snapshotState(engine: TimelineEngine): GameState {
  return deepCloneGameState(engine.getState() as GameState);
}

// Standard move: player 0 moves from general at (0,0) going RIGHT.
const P0_MOVE_RIGHT: MoveInput = {
  playerIndex: 0,
  sourceCoord: { x: 0, y: 0 },
  direction: Direction.RIGHT,
};

// Standard move: player 1 moves from general at (4,4) going LEFT.
const P1_MOVE_LEFT: MoveInput = {
  playerIndex: 1,
  sourceCoord: { x: 4, y: 4 },
  direction: Direction.LEFT,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimelineEngine', () => {
  // -------------------------------------------------------------------------
  // Construction & initial state
  // -------------------------------------------------------------------------
  describe('construction & initial state', () => {
    test('starts at tick 0', () => {
      const engine = makeEngine();
      expect(engine.getCurrentTick()).toBe(0);
    });

    test('getMaxTick() returns 0 initially', () => {
      const engine = makeEngine();
      expect(engine.getMaxTick()).toBe(0);
    });

    test('getState() returns a state matching the initial state', () => {
      const initialState = makeTestGameState();
      const engine = new TimelineEngine(initialState, QUIET_TIMING);
      const state = engine.getState();

      expect(state.tick).toBe(0);
      expect(state.board.size).toEqual({ width: 5, height: 5 });

      // Check player 0's general
      const p0General = state.board.grid[0][0] as PlayerSquare;
      expect(p0General.type).toBe(PlayerSquareType.GENERAL);
      expect(p0General.playerIndex).toBe(0);
      expect(p0General.units).toBe(10);

      // Check player 1's general
      const p1General = state.board.grid[4][4] as PlayerSquare;
      expect(p1General.type).toBe(PlayerSquareType.GENERAL);
      expect(p1General.playerIndex).toBe(1);
      expect(p1General.units).toBe(10);
    });

    test('modifying the input state after construction does not affect engine', () => {
      const initialState = makeTestGameState(10, 10);
      const engine = new TimelineEngine(initialState, QUIET_TIMING);

      // Mutate the input state
      (initialState.board.grid[0][0] as PlayerSquare).units = 999;
      initialState.tick = 42;

      // Engine state should be unaffected
      const engineState = engine.getState();
      expect(engineState.tick).toBe(0);
      expect((engineState.board.grid[0][0] as PlayerSquare).units).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  // tick()
  // -------------------------------------------------------------------------
  describe('tick()', () => {
    test('single tick with no moves advances tick to 1', () => {
      const engine = makeEngine();
      engine.tick([]);

      expect(engine.getCurrentTick()).toBe(1);
      expect(engine.getMaxTick()).toBe(1);
    });

    test('single tick with no moves still advances game state (tick field increments)', () => {
      const engine = makeEngine();
      engine.tick([]);

      expect(engine.getState().tick).toBe(1);
    });

    test('single tick with a valid move applies the move and records it', () => {
      const engine = makeEngine();
      const result = engine.tick([P0_MOVE_RIGHT]);

      // Move was applied
      expect(result.appliedEvents).toHaveLength(1);
      expect(result.appliedEvents[0].playerIndex).toBe(0);
      expect(result.appliedEvents[0].direction).toBe(Direction.RIGHT);

      // Board reflects the move: general at (0,0) should have 1 unit,
      // army at (1,0) should have 9 units
      const state = engine.getState();
      expect(getUnits(state, { x: 0, y: 0 })).toBe(1);
      expect(getUnits(state, { x: 1, y: 0 })).toBe(9);
      expect(getOwner(state, { x: 1, y: 0 })).toBe(0);
    });

    test('tick with an invalid move: move not applied, not in appliedEvents', () => {
      // Player 0's general has only 1 unit -- insufficient to move
      const gameState = makeTestGameState(1, 10);
      const engine = makeEngine(gameState);
      const result = engine.tick([P0_MOVE_RIGHT]);

      expect(result.appliedEvents).toHaveLength(0);

      // Board unchanged for player 0's general
      const state = engine.getState();
      expect(getUnits(state, { x: 0, y: 0 })).toBe(1);
      expect(getSquare(state, { x: 1, y: 0 }).type).toBe(NeutralSquareType.BLANK);
    });

    test('tick with move into a mountain: move not applied', () => {
      const board = makeTestBoard(10, 10);
      placeMountain(board, { x: 1, y: 0 });
      const gameState = createGameState(board, 2);
      const engine = makeEngine(gameState);

      const result = engine.tick([P0_MOVE_RIGHT]);
      expect(result.appliedEvents).toHaveLength(0);

      // General still has 10 units, no army placed
      const state = engine.getState();
      expect(getUnits(state, { x: 0, y: 0 })).toBe(10);
      expect(getSquare(state, { x: 1, y: 0 }).type).toBe(NeutralSquareType.MOUNTAIN);
    });

    test('multiple ticks advance tick correctly', () => {
      const engine = makeEngine();
      tickN(engine, 10);

      expect(engine.getCurrentTick()).toBe(10);
      expect(engine.getMaxTick()).toBe(10);
      expect(engine.getState().tick).toBe(10);
    });

    test('tick() assigns step on MoveEvent (caller passes MoveInput without step)', () => {
      const engine = makeEngine();

      const result1 = engine.tick([P0_MOVE_RIGHT]);
      expect(result1.appliedEvents).toHaveLength(1);
      expect(result1.appliedEvents[0].step).toBe(1);

      // Tick again -- player 0 now has army at (1,0) with 9 units. Move it right.
      const result2 = engine.tick([
        {
          playerIndex: 0,
          sourceCoord: { x: 1, y: 0 },
          direction: Direction.RIGHT,
        },
      ]);
      expect(result2.appliedEvents).toHaveLength(1);
      expect(result2.appliedEvents[0].step).toBe(2);
    });

    test('multiple moves per tick (multiplayer): all valid ones recorded', () => {
      const engine = makeEngine();
      const result = engine.tick([P0_MOVE_RIGHT, P1_MOVE_LEFT]);

      // Both moves should be applied
      expect(result.appliedEvents).toHaveLength(2);
      const playerIndices = result.appliedEvents.map((e) => e.playerIndex).sort();
      expect(playerIndices).toEqual([0, 1]);

      // Verify board reflects both moves
      const state = engine.getState();
      expect(getUnits(state, { x: 0, y: 0 })).toBe(1); // P0 general left with 1
      expect(getUnits(state, { x: 1, y: 0 })).toBe(9); // P0 army
      expect(getUnits(state, { x: 4, y: 4 })).toBe(1); // P1 general left with 1
      expect(getUnits(state, { x: 3, y: 4 })).toBe(9); // P1 army
    });

    test('mix of valid and invalid moves: only valid ones recorded', () => {
      // P0 has 10 units (valid), P1 has 1 unit (insufficient to move)
      const gameState = makeTestGameState(10, 1);
      const engine = makeEngine(gameState);
      const result = engine.tick([P0_MOVE_RIGHT, P1_MOVE_LEFT]);

      expect(result.appliedEvents).toHaveLength(1);
      expect(result.appliedEvents[0].playerIndex).toBe(0);
    });

    test('checkpoints saved at correct interval', () => {
      const engine = makeEngine(undefined, undefined, { checkpointInterval: 5 });

      // Tick to 5 -- checkpoint should exist at tick 0 and tick 5
      tickN(engine, 5);
      expect(engine.getCurrentTick()).toBe(5);

      // Jump to tick 0 should work (checkpoint at 0)
      engine.jumpToTick(0);
      expect(engine.getCurrentTick()).toBe(0);
      expect(engine.getState().tick).toBe(0);

      // Jump to tick 5 should work (checkpoint at 5, or replay from 0)
      engine.jumpToTick(5);
      expect(engine.getCurrentTick()).toBe(5);
      expect(engine.getState().tick).toBe(5);
    });

    test('tick returns ProcessStepResult with gameEnded info', () => {
      // Set up a scenario where P0 captures P1's general
      const board = makeBoard(3, 1);
      placeGeneral(board, { x: 0, y: 0 }, 0, 10);
      placeGeneral(board, { x: 2, y: 0 }, 1, 1);
      const gameState = createGameState(board, 2);
      const engine = makeEngine(gameState);

      // Move P0 right to (1,0)
      engine.tick([
        {
          playerIndex: 0,
          sourceCoord: { x: 0, y: 0 },
          direction: Direction.RIGHT,
        },
      ]);

      // Move P0 army from (1,0) right to (2,0) -- captures general
      const result = engine.tick([
        {
          playerIndex: 0,
          sourceCoord: { x: 1, y: 0 },
          direction: Direction.RIGHT,
        },
      ]);

      expect(result.gameEnded).toBe(true);
      expect(result.winnerPlayerIndex).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // jumpToTick()
  // -------------------------------------------------------------------------
  describe('jumpToTick()', () => {
    test('jump backward to tick 0', () => {
      const engine = makeEngine();
      const stateAtTick0 = snapshotState(engine);

      tickN(engine, 5);
      expect(engine.getCurrentTick()).toBe(5);

      engine.jumpToTick(0);
      expect(engine.getCurrentTick()).toBe(0);
      expect(engine.getState().tick).toBe(0);

      // Board state should match original tick 0 state
      const restored = engine.getState();
      expect(restored.board.grid).toEqual(stateAtTick0.board.grid);
    });

    test('jump backward to an arbitrary tick', () => {
      const engine = makeEngine();

      // Tick 5 times with a move at tick 3 (from P0 general going RIGHT)
      tickN(engine, 2);
      engine.tick([P0_MOVE_RIGHT]); // tick 3
      const stateAtTick3 = snapshotState(engine);
      tickN(engine, 2); // ticks 4, 5

      expect(engine.getCurrentTick()).toBe(5);

      engine.jumpToTick(3);
      expect(engine.getCurrentTick()).toBe(3);
      expect(engine.getState().tick).toBe(3);

      // State should match what it was at tick 3 (after P0 moved right)
      const restored = engine.getState();
      expect(getUnits(restored, { x: 0, y: 0 })).toBe(
        getUnits(stateAtTick3, { x: 0, y: 0 }),
      );
      expect(getUnits(restored, { x: 1, y: 0 })).toBe(
        getUnits(stateAtTick3, { x: 1, y: 0 }),
      );
      expect(restored.board.grid).toEqual(stateAtTick3.board.grid);
    });

    test('jump forward to a previously visited tick', () => {
      const engine = makeEngine();

      tickN(engine, 3);
      engine.tick([P0_MOVE_RIGHT]); // tick 4
      const stateAtTick4 = snapshotState(engine);
      tickN(engine, 3); // ticks 5, 6, 7

      // Jump back first
      engine.jumpToTick(2);
      expect(engine.getCurrentTick()).toBe(2);

      // Now jump forward to tick 4
      engine.jumpToTick(4);
      expect(engine.getCurrentTick()).toBe(4);
      expect(engine.getState().tick).toBe(4);

      // State should match the original tick 4 state
      const restored = engine.getState();
      expect(restored.board.grid).toEqual(stateAtTick4.board.grid);
    });

    test('jump to current tick is a no-op', () => {
      const engine = makeEngine();
      tickN(engine, 5);

      const stateBefore = snapshotState(engine);
      engine.jumpToTick(5);

      expect(engine.getCurrentTick()).toBe(5);
      expect(engine.getState().board.grid).toEqual(stateBefore.board.grid);
    });

    test('jump to negative tick throws', () => {
      const engine = makeEngine();
      tickN(engine, 3);

      expect(() => engine.jumpToTick(-1)).toThrow();
    });

    test('jump beyond maxTick throws', () => {
      const engine = makeEngine();
      tickN(engine, 3);

      expect(() => engine.jumpToTick(4)).toThrow();
      expect(() => engine.jumpToTick(100)).toThrow();
    });

    test('state after jump matches what the state was at that tick originally', () => {
      const engine = makeEngine();

      // Record states at each tick with moves at specific ticks
      const snapshots: GameState[] = [];
      snapshots.push(snapshotState(engine)); // tick 0

      engine.tick([P0_MOVE_RIGHT]); // tick 1: P0 moves right from (0,0)
      snapshots.push(snapshotState(engine));

      engine.tick([]); // tick 2: no moves
      snapshots.push(snapshotState(engine));

      engine.tick([P1_MOVE_LEFT]); // tick 3: P1 moves left from (4,4)
      snapshots.push(snapshotState(engine));

      engine.tick([]); // tick 4: no moves
      snapshots.push(snapshotState(engine));

      // Jump to each tick and verify state matches
      for (let tick = 0; tick <= 4; tick++) {
        engine.jumpToTick(tick);
        expect(engine.getCurrentTick()).toBe(tick);

        const restored = engine.getState();
        expect(restored.tick).toBe(snapshots[tick].tick);
        expect(restored.board.grid).toEqual(snapshots[tick].board.grid);
        expect(restored.players).toEqual(snapshots[tick].players);
      }
    });

    test('jump backward and forward across a checkpoint boundary', () => {
      const engine = makeEngine(undefined, undefined, { checkpointInterval: 3 });

      // Tick 7 times with a move at tick 5
      tickN(engine, 4);
      engine.tick([P0_MOVE_RIGHT]); // tick 5
      const stateAtTick5 = snapshotState(engine);
      tickN(engine, 2); // ticks 6, 7

      // Jump to tick 1 (before checkpoint at 3)
      engine.jumpToTick(1);
      expect(engine.getCurrentTick()).toBe(1);

      // Jump forward to tick 5 (across checkpoint at 3)
      engine.jumpToTick(5);
      expect(engine.getCurrentTick()).toBe(5);
      expect(engine.getState().board.grid).toEqual(stateAtTick5.board.grid);
    });
  });

  // -------------------------------------------------------------------------
  // Branching (tick after jumpToTick)
  // -------------------------------------------------------------------------
  describe('branching', () => {
    test('tick after jumping back truncates future history', () => {
      const engine = makeEngine();

      // Build history: tick 1-5, with P0 move at tick 3
      tickN(engine, 2);
      engine.tick([P0_MOVE_RIGHT]); // tick 3
      tickN(engine, 2); // ticks 4, 5
      expect(engine.getMaxTick()).toBe(5);

      // Jump back to tick 2, then tick with a DIFFERENT move (P1 instead of P0)
      engine.jumpToTick(2);
      engine.tick([P1_MOVE_LEFT]); // new tick 3 -- branches

      // maxTick should reflect the branch
      expect(engine.getMaxTick()).toBe(3);
      expect(engine.getCurrentTick()).toBe(3);

      // The P1 move should be reflected, not the old P0 move
      const state = engine.getState();
      expect(getUnits(state, { x: 4, y: 4 })).toBe(1); // P1 general left with 1
      expect(getUnits(state, { x: 3, y: 4 })).toBe(9); // P1 army at (3,4)

      // P0's general should still have 10 units (old P0 move at tick 3 is gone)
      expect(getUnits(state, { x: 0, y: 0 })).toBe(10);
    });

    test('tick after jumping back truncates future checkpoints', () => {
      const engine = makeEngine(undefined, undefined, { checkpointInterval: 3 });

      // Tick to 7 -- checkpoints at 0, 3, 6
      tickN(engine, 7);
      expect(engine.getMaxTick()).toBe(7);

      // Jump back to tick 2
      engine.jumpToTick(2);
      engine.tick([]); // new tick 3 -- branches, old checkpoints at 3 and 6 should be gone

      // Verify by ticking forward: the engine should work correctly
      // (if checkpoints were corrupt, replay would produce wrong state)
      tickN(engine, 4); // ticks 4, 5, 6, 7
      expect(engine.getMaxTick()).toBe(7);
      expect(engine.getCurrentTick()).toBe(7);

      // Jump back should still work via remaining checkpoints
      engine.jumpToTick(0);
      expect(engine.getCurrentTick()).toBe(0);
    });

    test('getMaxTick() resets to branch point after branching', () => {
      const engine = makeEngine();

      tickN(engine, 10);
      expect(engine.getMaxTick()).toBe(10);

      engine.jumpToTick(5);
      expect(engine.getMaxTick()).toBe(10); // hasn't branched yet

      engine.tick([]); // tick 6 -- now it branches
      expect(engine.getMaxTick()).toBe(6); // maxTick is now 6, not 10
    });

    test('new moves after branching recorded correctly', () => {
      const engine = makeEngine();

      // Original timeline: tick 1 has P0 move, tick 2 has no moves
      engine.tick([P0_MOVE_RIGHT]); // tick 1
      engine.tick([]); // tick 2

      // Branch from tick 0
      engine.jumpToTick(0);
      engine.tick([P1_MOVE_LEFT]); // new tick 1 -- P1 moves instead of P0

      // Verify the new branch's state
      const state = engine.getState();
      expect(getUnits(state, { x: 0, y: 0 })).toBe(10); // P0 didn't move
      expect(getUnits(state, { x: 4, y: 4 })).toBe(1); // P1 moved
      expect(getUnits(state, { x: 3, y: 4 })).toBe(9); // P1 army

      // Jump back to tick 0 and forward to tick 1 -- should use new branch
      engine.jumpToTick(0);
      engine.jumpToTick(1);

      const restored = engine.getState();
      expect(getUnits(restored, { x: 0, y: 0 })).toBe(10); // P0 didn't move
      expect(getUnits(restored, { x: 3, y: 4 })).toBe(9); // P1's army still there
    });

    test('old history beyond branch point is gone', () => {
      const engine = makeEngine();

      // Original timeline: P0 moves right at tick 1, then P1 moves left at tick 2
      engine.tick([P0_MOVE_RIGHT]); // tick 1
      engine.tick([P1_MOVE_LEFT]); // tick 2

      // Branch from tick 0 with NO moves
      engine.jumpToTick(0);
      engine.tick([]); // new tick 1 -- no moves (different from original)

      // Now at tick 1, state should NOT have P0's move applied
      const branchedState = engine.getState();
      expect(getUnits(branchedState, { x: 0, y: 0 })).toBe(10);
      expect(branchedState.board.grid[0][1].type).toBe(NeutralSquareType.BLANK);

      // The old tick 2 (P1 move) should be completely gone
      expect(engine.getMaxTick()).toBe(1);
      expect(() => engine.jumpToTick(2)).toThrow();
    });

    test('branching preserves pre-branch history', () => {
      const engine = makeEngine();

      // Tick 1: P0 moves right, Tick 2: no moves, Tick 3: P1 moves left
      engine.tick([P0_MOVE_RIGHT]); // tick 1
      const stateAtTick1 = snapshotState(engine);
      engine.tick([]); // tick 2
      engine.tick([P1_MOVE_LEFT]); // tick 3

      // Branch from tick 1
      engine.jumpToTick(1);
      engine.tick([]); // new tick 2 -- branches, but tick 1 history preserved

      // Jump back to tick 1 -- should have P0's move
      engine.jumpToTick(1);
      const restored = engine.getState();
      expect(restored.board.grid).toEqual(stateAtTick1.board.grid);
    });
  });

  // -------------------------------------------------------------------------
  // reset()
  // -------------------------------------------------------------------------
  describe('reset()', () => {
    test('resets tick to 0 and maxTick to 0', () => {
      const engine = makeEngine();
      tickN(engine, 10);

      engine.reset();

      expect(engine.getCurrentTick()).toBe(0);
      expect(engine.getMaxTick()).toBe(0);
    });

    test('state matches initial state after reset', () => {
      const initialState = makeTestGameState(10, 10);
      const engine = new TimelineEngine(initialState, QUIET_TIMING);

      // Take a snapshot of the initial state
      const initialSnapshot = snapshotState(engine);

      // Make some moves
      engine.tick([P0_MOVE_RIGHT]);
      engine.tick([P1_MOVE_LEFT]);
      tickN(engine, 5);

      engine.reset();

      const state = engine.getState();
      expect(state.tick).toBe(0);
      expect(state.board.grid).toEqual(initialSnapshot.board.grid);
      expect(state.players).toEqual(initialSnapshot.players);
    });

    test('history is cleared after reset', () => {
      const engine = makeEngine();

      engine.tick([P0_MOVE_RIGHT]);
      tickN(engine, 5);

      engine.reset();

      // Cannot jump to any previous tick (history is gone)
      expect(() => engine.jumpToTick(1)).toThrow();
      expect(engine.getMaxTick()).toBe(0);
    });

    test('can tick normally after reset', () => {
      const engine = makeEngine();

      tickN(engine, 5);
      engine.tick([P0_MOVE_RIGHT]); // tick 6
      engine.reset();

      // Should be able to tick from scratch
      engine.tick([P0_MOVE_RIGHT]); // new tick 1
      expect(engine.getCurrentTick()).toBe(1);
      expect(engine.getMaxTick()).toBe(1);

      // Move should have been applied
      const state = engine.getState();
      expect(getUnits(state, { x: 0, y: 0 })).toBe(1);
      expect(getUnits(state, { x: 1, y: 0 })).toBe(9);
    });

    test('reset followed by jumpToTick(0) is valid', () => {
      const engine = makeEngine();
      tickN(engine, 5);

      engine.reset();
      engine.jumpToTick(0);

      expect(engine.getCurrentTick()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // deepCloneGameState
  // -------------------------------------------------------------------------
  describe('deepCloneGameState', () => {
    test('clone is deeply equal but not same reference', () => {
      const original = makeTestGameState(10, 10);
      const clone = deepCloneGameState(original);

      // Deeply equal
      expect(clone).toEqual(original);

      // Not same references
      expect(clone).not.toBe(original);
      expect(clone.board).not.toBe(original.board);
      expect(clone.board.grid).not.toBe(original.board.grid);
      expect(clone.board.grid[0]).not.toBe(original.board.grid[0]);
      expect(clone.board.grid[0][0]).not.toBe(original.board.grid[0][0]);
      expect(clone.players).not.toBe(original.players);
      expect(clone.players[0]).not.toBe(original.players[0]);
    });

    test('mutating clone does not affect original', () => {
      const original = makeTestGameState(10, 10);
      const clone = deepCloneGameState(original);

      // Mutate the clone at multiple levels
      clone.tick = 999;
      clone.board.size = { width: 100, height: 100 };
      (clone.board.grid[0][0] as PlayerSquare).units = 777;
      clone.players[0].armyCount = 555;

      // Original should be untouched
      expect(original.tick).toBe(0);
      expect(original.board.size).toEqual({ width: 5, height: 5 });
      expect((original.board.grid[0][0] as PlayerSquare).units).toBe(10);
      expect(original.players[0].armyCount).not.toBe(555);
    });

    test('mutating original does not affect clone', () => {
      const original = makeTestGameState(10, 10);
      const clone = deepCloneGameState(original);

      // Mutate the original
      (original.board.grid[0][0] as PlayerSquare).units = 1;
      original.players.push({
        status: 'active' as any,
        armyCount: 0,
        landCount: 0,
      });

      // Clone should be untouched
      expect((clone.board.grid[0][0] as PlayerSquare).units).toBe(10);
      expect(clone.players).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Integration: production interacts with timeline
  // -------------------------------------------------------------------------
  describe('production integration', () => {
    test('production occurs at correct ticks and jumpToTick replays it accurately', () => {
      const engine = makeEngine(makeTestGameState(1, 1), FAST_PRODUCTION_TIMING);

      // generalProductionTicks=2, so production at ticks 2, 4, 6...
      tickN(engine, 6);

      const stateAtTick6 = snapshotState(engine);
      // General started with 1, +1 at tick 2, +1 at tick 4, +1 at tick 6 = 4
      expect(getUnits(stateAtTick6, { x: 0, y: 0 })).toBe(4);

      // Jump to tick 4 and verify
      engine.jumpToTick(4);
      expect(getUnits(engine.getState(), { x: 0, y: 0 })).toBe(3);

      // Jump to tick 2
      engine.jumpToTick(2);
      expect(getUnits(engine.getState(), { x: 0, y: 0 })).toBe(2);

      // Jump to tick 0
      engine.jumpToTick(0);
      expect(getUnits(engine.getState(), { x: 0, y: 0 })).toBe(1);

      // Jump back to tick 6 to verify full replay
      engine.jumpToTick(6);
      expect(getUnits(engine.getState(), { x: 0, y: 0 })).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    test('jumpToTick(0) on a fresh engine is a no-op', () => {
      const engine = makeEngine();
      engine.jumpToTick(0);

      expect(engine.getCurrentTick()).toBe(0);
      expect(engine.getMaxTick()).toBe(0);
    });

    test('tick at maxTick does not trigger branching', () => {
      const engine = makeEngine();
      tickN(engine, 5);
      expect(engine.getCurrentTick()).toBe(5);
      expect(engine.getMaxTick()).toBe(5);

      // This tick should NOT truncate -- we're at maxTick
      engine.tick([P0_MOVE_RIGHT]);
      expect(engine.getCurrentTick()).toBe(6);
      expect(engine.getMaxTick()).toBe(6);

      // The move should be recorded
      const state = engine.getState();
      expect(getUnits(state, { x: 0, y: 0 })).toBe(1);
    });

    test('many ticks and jumps maintain consistency', () => {
      const engine = makeEngine(undefined, undefined, { checkpointInterval: 5 });

      // Tick 20 times with no moves. Snapshots at several points.
      tickN(engine, 8);
      const stateAtTick8 = snapshotState(engine);
      tickN(engine, 12); // total 20

      const stateAtTick20 = snapshotState(engine);

      // Jump around extensively
      engine.jumpToTick(0);
      engine.jumpToTick(10);
      engine.jumpToTick(3);
      engine.jumpToTick(8);
      expect(engine.getState().board.grid).toEqual(stateAtTick8.board.grid);

      engine.jumpToTick(20);
      expect(engine.getState().board.grid).toEqual(stateAtTick20.board.grid);
    });

    test('checkpoint at tick 0 always exists even with large interval', () => {
      const engine = makeEngine(undefined, undefined, { checkpointInterval: 100 });
      tickN(engine, 5);

      // Jump to 0 should work (checkpoint at tick 0)
      engine.jumpToTick(0);
      expect(engine.getCurrentTick()).toBe(0);
    });

    test('jumpToTick exactly at maxTick', () => {
      const engine = makeEngine();
      tickN(engine, 7);

      engine.jumpToTick(3);
      engine.jumpToTick(7); // exactly maxTick
      expect(engine.getCurrentTick()).toBe(7);
      expect(engine.getState().tick).toBe(7);
    });
  });
});
