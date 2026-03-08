import { Board } from '@core/board';
import { Direction } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

import { tilesEqual } from './tile-data';
import { computeTileData, type QueuedDirs } from './tile-derived-state';
import type {
  BoardSourceState,
  DerivedState,
  FrameDiff,
  FrameInputs,
  TileData,
  UIState,
} from './types';

function computeDerivedState(source: BoardSourceState, _ui: UIState): DerivedState {
  const allVisible = source.status === 'ended' || source.currentPlayerIndex === null;
  const visibleSquares =
    allVisible || !source.board
      ? new Set<string>()
      : Board.getVisibleSquares(source.board, source.currentPlayerIndex!);
  return { visibleSquares, allVisible };
}

function computeFrameAndDiff(
  inputs: FrameInputs,
  frame: TileData[],
  width: number,
  _height: number,
): FrameDiff {
  const board = inputs.source.board!;
  const changes: FrameDiff = [];

  const queuedMovesMap = new Map<string, QueuedDirs>();
  for (const move of inputs.source.queuedMoves) {
    const key = serializeCoord(move.sourceCoord);
    let dirs = queuedMovesMap.get(key);
    if (!dirs) {
      dirs = { up: false, down: false, left: false, right: false };
      queuedMovesMap.set(key, dirs);
    }
    if (move.direction === Direction.UP) dirs.up = true;
    else if (move.direction === Direction.DOWN) dirs.down = true;
    else if (move.direction === Direction.LEFT) dirs.left = true;
    else if (move.direction === Direction.RIGHT) dirs.right = true;
  }

  Board.forEachCoord(board, (coord, _square) => {
    const index = coord.y * width + coord.x;
    const newData = computeTileData(inputs, coord, queuedMovesMap);
    const oldData = frame[index];

    if (!oldData || !tilesEqual(oldData, newData)) {
      frame[index] = newData;
      changes.push({ coord, index, data: newData });
    }
  });

  return changes;
}

export { computeDerivedState, computeFrameAndDiff };
