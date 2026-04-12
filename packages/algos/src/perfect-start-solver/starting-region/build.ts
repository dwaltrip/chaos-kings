import { type FlatBoard } from '@core-next/flat-board';

import { bfsDistanceField } from '../utils/bfs-distance-field';
import { resolveCrop } from '../utils/crop-board';

import type { StartingRegion } from './types';

// Default radius. MAX_D should cover the longest full burst (prefix +
// suffix), not just the prefix depth, so that analysis near the boundary
// of the region still has context. 13 is a reasonable first-pass value
// given typical B1 burst lengths observed in the burst segmentation data.
const DEFAULT_MAX_DEPTH = 13;

interface BuildOptions {
  maxDepth?: number;
  // Padding (in tiles) around the starting region when computing bbox.
  padding?: number;
}

function buildStartingRegion(
  board: FlatBoard,
  general: number,
  options: BuildOptions = {},
): StartingRegion {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const padding = options.padding ?? 1;

  const field = bfsDistanceField(board, general, { maxDepth });
  const tiles = new Set<number>(field.order);

  const bbox = resolveCrop(board, { kind: 'tiles', tiles, padding });

  return {
    general,
    tiles,
    distance: field.distance,
    order: field.order,
    maxDepth,
    bbox,
  };
}

export type { BuildOptions };
export { DEFAULT_MAX_DEPTH, buildStartingRegion };
