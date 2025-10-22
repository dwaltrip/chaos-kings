import { processStep } from '@core/step-processor';
import { PlayerSquareType, NeutralSquareType, Direction } from '@core/types';
import type { BoardState, Coord, Square } from '@core/types';
import type { MoveEvent } from '@core/replay/types';
import type { TimingConfig } from '@core/timing/types';

function makeBoard(
  width: number,
  height: number,
  fill?: (coord: Coord) => Square,
): BoardState {
  const grid: Square[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Square[] = [];
    for (let x = 0; x < width; x++) {
      const coord = { x, y };
      row.push(fill ? fill(coord) : ({ type: NeutralSquareType.BLANK, coord } as Square));
    }
    grid.push(row);
  }
  return { grid, size: { width, height } };
}

const timing: TimingConfig = {
  tickRateMs: 500,
  generalProductionTicks: 2, // won't trigger at step 1
  armyProductionTicks: 50, // won't trigger at step 1
};

describe('processStep ordering by playerIndex', () => {
  test('lower playerIndex moves apply first on contested destination', () => {
    // Board: P0(3) at (0,0) -> RIGHT; P1(3) at (2,0) -> LEFT; middle (1,0) blank
    const board = makeBoard(3, 1);
    (board.grid[0][0] as any) = {
      type: PlayerSquareType.ARMY,
      coord: { x: 0, y: 0 },
      playerIndex: 0,
      units: 3,
    };
    (board.grid[0][2] as any) = {
      type: PlayerSquareType.ARMY,
      coord: { x: 2, y: 0 },
      playerIndex: 1,
      units: 3,
    };

    const events: MoveEvent[] = [
      {
        step: 1,
        playerIndex: 1,
        sourceCoord: { x: 2, y: 0 },
        direction: Direction.LEFT,
      },
      {
        step: 1,
        playerIndex: 0,
        sourceCoord: { x: 0, y: 0 },
        direction: Direction.RIGHT,
      },
    ];

    const { appliedEvents } = processStep(board, 1, events, timing);

    // Both moves are valid; both should be applied in playerIndex order (0 then 1)
    expect(appliedEvents.map((e) => e.playerIndex)).toEqual([0, 1]);

    // Destination (1,0) should end owned by player 0 after both moves resolve
    const dest = board.grid[0][1] as any;
    expect(dest.playerIndex).toBe(0);
  });
});
