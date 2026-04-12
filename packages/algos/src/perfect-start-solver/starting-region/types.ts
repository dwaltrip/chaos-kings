import type { CropRect } from '../utils/crop-board';

// BFS-bounded neighborhood of the general. The starting region is the
// universe of tiles that could possibly be involved in the first round
// of bursts — everything outside is irrelevant to prefix generation.
interface StartingRegion {
  // The general tile index (distance 0 in the field).
  general: number;

  // All tiles reachable from the general within maxDepth steps.
  tiles: Set<number>;

  // BFS distance from the general, indexed by tile. Only reachable tiles
  // are present. Equal to bfsDistanceField's `distance` output.
  distance: Map<number, number>;

  // BFS order — start first, then radiating outward. Useful for
  // deterministic iteration by distance.
  order: number[];

  // The radius used for the BFS. Tiles at exactly this depth are included.
  maxDepth: number;

  // Minimal bounding box around the starting region (with padding), for
  // cropped rendering.
  bbox: CropRect;
}

export type { StartingRegion };
