// A contiguous (or near-contiguous) region of claimed tiles on a board.
// Stored as both a Set and a bitmask — Sets are convenient for iteration,
// masks are fast for overlap checks.
interface Blob {
  tiles: Set<number>;
  mask: bigint;
}

// An ordered non-backtracking path of tiles, starting at a frontier tile
// and extending outward. `mask` is the union of `tiles` for fast overlap checks.
interface Lane {
  tiles: number[];
  mask: bigint;
}

// A request for one lane in a decomposition. Currently just a target length,
// but wrapped in an object so we can add entry constraints later.
interface LaneRequest {
  length: number;
}

// An ordered tuple of Lanes, positionally matching a LaneRequest[].
type Decomposition = Lane[];

export type { Blob, Lane, LaneRequest, Decomposition };
