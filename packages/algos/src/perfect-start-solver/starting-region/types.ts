import type { CropRect } from '../utils/crop-board';

// Per-tile annotations describing the local topology of the starting
// region. All maps are keyed by tile index; only tiles in the starting
// region are present.
interface StartingRegionAnnotations {
  // Number of walkable neighbors (within the starting region) with d+1.
  // Measures "how many forward directions this tile offers."
  outwardDivergence: Map<number, number>;

  // Number of walkable neighbors (within the starting region) with d-1.
  // Useful for choke / branching analysis.
  inwardCount: Map<number, number>;

  // Max straight-ray depth from this tile over the 4 cardinal directions,
  // stopping at mountains or board edges. Mirrors the face-projection
  // convention (depth includes the starting tile itself). Does NOT stop
  // at the starting region boundary — rays extend as far as walkable
  // geometry allows, so this reflects board openness from this tile.
  outwardRayDepth: Map<number, number>;

  // Articulation points and bridges of the starting region's induced
  // subgraph (computed via tarjanInSet — NOT the same as full-board
  // articulation points, because removing a tile that disconnects the
  // starting region may not disconnect the full board, and vice versa).
  articulationPoints: Set<number>;
  bridges: Array<[number, number]>;
}

// BFS-bounded neighborhood of the general, plus topological annotations.
// The starting region is the universe of tiles that could possibly be
// involved in the first round of bursts — everything outside is irrelevant
// to prefix generation.
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

  annotations: StartingRegionAnnotations;
}

export type { StartingRegion, StartingRegionAnnotations };
