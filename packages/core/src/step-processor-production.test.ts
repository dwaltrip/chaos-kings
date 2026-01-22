import { processStep, createGameState } from '@core/step-processor';
import { PlayerSquareType, NeutralSquareType } from '@core/types';
import type { BoardState, Coord, Square, GameState } from '@core/types';
import type { TimingConfig } from '@core/timing/types';

// Default timing config matching game-timing-config.ts
const DEFAULT_TIMING: TimingConfig = {
  tickRateMs: 500,
  generalProductionTicks: 2,
  armyProductionTicks: 50,
};

// --- Helpers ---

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

function placeCity(
  board: BoardState,
  coord: Coord,
  playerIndex: number,
  units = 1,
): void {
  board.grid[coord.y][coord.x] = {
    type: PlayerSquareType.PLAYER_CITY,
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

function getUnits(state: GameState, coord: Coord): number {
  const square = state.board.grid[coord.y][coord.x];
  if ('units' in square) return square.units;
  throw new Error(`Square at ${coord.x},${coord.y} has no units`);
}

function runSteps(state: GameState, count: number, timing: TimingConfig): void {
  for (let i = 0; i < count; i++) {
    processStep(state, [], timing);
  }
}

function runUntilTick(state: GameState, targetTick: number, timing: TimingConfig): void {
  while (state.tick < targetTick) {
    processStep(state, [], timing);
  }
}

// --- Tests ---

describe('step-processor production', () => {
  describe('general production', () => {
    test('no production before first interval', () => {
      const board = makeBoard(3, 3);
      placeGeneral(board, { x: 0, y: 0 }, 0);
      placeGeneral(board, { x: 2, y: 2 }, 1);
      const state = createGameState(board, 2);

      // Run up to but not including first production tick
      runSteps(state, DEFAULT_TIMING.generalProductionTicks - 1, DEFAULT_TIMING);

      expect(state.tick).toBe(DEFAULT_TIMING.generalProductionTicks - 1);
      expect(getUnits(state, { x: 0, y: 0 })).toBe(1);
    });

    test('produces +1 at first interval', () => {
      const board = makeBoard(3, 3);
      placeGeneral(board, { x: 0, y: 0 }, 0);
      placeGeneral(board, { x: 2, y: 2 }, 1);
      const state = createGameState(board, 2);

      runSteps(state, DEFAULT_TIMING.generalProductionTicks, DEFAULT_TIMING);

      expect(state.tick).toBe(DEFAULT_TIMING.generalProductionTicks);
      expect(getUnits(state, { x: 0, y: 0 })).toBe(2);
    });

    test('cumulative production over multiple turns', () => {
      const board = makeBoard(3, 3);
      placeGeneral(board, { x: 0, y: 0 }, 0);
      placeGeneral(board, { x: 2, y: 2 }, 1);
      const state = createGameState(board, 2);

      const turns = 20;
      const targetTick = DEFAULT_TIMING.generalProductionTicks * turns;
      runUntilTick(state, targetTick, DEFAULT_TIMING);

      // Started with 1, gained 20 from production
      expect(getUnits(state, { x: 0, y: 0 })).toBe(turns + 1);
    });
  });

  describe('all-land production (armyProductionTicks)', () => {
    test('general gets +2 on all-land tick (regular + all-land bonus)', () => {
      const board = makeBoard(3, 3);
      placeGeneral(board, { x: 0, y: 0 }, 0);
      placeGeneral(board, { x: 2, y: 2 }, 1);
      const state = createGameState(board, 2);

      runUntilTick(state, DEFAULT_TIMING.armyProductionTicks, DEFAULT_TIMING);

      // 50 ticks = 25 turns of general production (25 units) + 1 all-land bonus + starting 1
      // Actually: started with 1, +25 from turns, +1 from all-land = 27
      const expectedTurns =
        DEFAULT_TIMING.armyProductionTicks / DEFAULT_TIMING.generalProductionTicks;
      expect(getUnits(state, { x: 0, y: 0 })).toBe(1 + expectedTurns + 1);
    });

    test('army only grows on all-land ticks, not every turn', () => {
      const board = makeBoard(3, 3);
      placeGeneral(board, { x: 0, y: 0 }, 0);
      placeGeneral(board, { x: 2, y: 2 }, 1);
      placeArmy(board, { x: 1, y: 1 }, 0, 5);
      const state = createGameState(board, 2);

      // Run to just before all-land tick
      runUntilTick(state, DEFAULT_TIMING.armyProductionTicks - 1, DEFAULT_TIMING);
      expect(getUnits(state, { x: 1, y: 1 })).toBe(5); // unchanged

      // Run one more step to hit all-land tick
      runSteps(state, 1, DEFAULT_TIMING);
      expect(getUnits(state, { x: 1, y: 1 })).toBe(6); // +1 from all-land
    });
  });

  describe('city production', () => {
    test('cities produce like generals', () => {
      const board = makeBoard(3, 3);
      placeGeneral(board, { x: 0, y: 0 }, 0);
      placeGeneral(board, { x: 2, y: 2 }, 1);
      placeCity(board, { x: 1, y: 1 }, 0, 1);
      const state = createGameState(board, 2);

      runSteps(state, DEFAULT_TIMING.generalProductionTicks, DEFAULT_TIMING);

      expect(getUnits(state, { x: 1, y: 1 })).toBe(2);
    });

    test('cities get +2 on all-land tick', () => {
      const board = makeBoard(3, 3);
      placeGeneral(board, { x: 0, y: 0 }, 0);
      placeGeneral(board, { x: 2, y: 2 }, 1);
      placeCity(board, { x: 1, y: 1 }, 0, 1);
      const state = createGameState(board, 2);

      runUntilTick(state, DEFAULT_TIMING.armyProductionTicks, DEFAULT_TIMING);

      const expectedTurns =
        DEFAULT_TIMING.armyProductionTicks / DEFAULT_TIMING.generalProductionTicks;
      expect(getUnits(state, { x: 1, y: 1 })).toBe(1 + expectedTurns + 1);
    });
  });

  describe('custom timing configs', () => {
    test('works with different generalProductionTicks', () => {
      const timing: TimingConfig = {
        tickRateMs: 500,
        generalProductionTicks: 4,
        armyProductionTicks: 100,
      };

      const board = makeBoard(3, 3);
      placeGeneral(board, { x: 0, y: 0 }, 0);
      placeGeneral(board, { x: 2, y: 2 }, 1);
      const state = createGameState(board, 2);

      // No production at tick 2 (would be production with default config)
      runSteps(state, 2, timing);
      expect(getUnits(state, { x: 0, y: 0 })).toBe(1);

      // Production at tick 4
      runSteps(state, 2, timing);
      expect(state.tick).toBe(4);
      expect(getUnits(state, { x: 0, y: 0 })).toBe(2);
    });

    test('works with different armyProductionTicks', () => {
      const timing: TimingConfig = {
        tickRateMs: 500,
        generalProductionTicks: 2,
        armyProductionTicks: 10,
      };

      const board = makeBoard(3, 3);
      placeGeneral(board, { x: 0, y: 0 }, 0);
      placeGeneral(board, { x: 2, y: 2 }, 1);
      placeArmy(board, { x: 1, y: 1 }, 0, 5);
      const state = createGameState(board, 2);

      // Army unchanged before tick 10
      runUntilTick(state, 9, timing);
      expect(getUnits(state, { x: 1, y: 1 })).toBe(5);

      // Army grows at tick 10
      runSteps(state, 1, timing);
      expect(getUnits(state, { x: 1, y: 1 })).toBe(6);
    });
  });
});
