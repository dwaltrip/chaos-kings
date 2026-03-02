import { Board } from '@core/board';
import type { Direction } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

import { computeTileData, tilesEqual } from './tile-data';
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

  // Pre-compute a map from serialized source coord → set of queued directions
  const queuedMovesMap = new Map<string, Set<Direction>>();
  for (const move of inputs.source.queuedMoves) {
    const key = serializeCoord(move.sourceCoord);
    let dirs = queuedMovesMap.get(key);
    if (!dirs) {
      dirs = new Set<Direction>();
      queuedMovesMap.set(key, dirs);
    }
    dirs.add(move.direction);
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
