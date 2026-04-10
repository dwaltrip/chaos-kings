import type { StartingRegion } from './types';

// Per-tile "lane-entry quality" scorer (v1).
//
// Under the session-3 reframe (see dev-notes/4.10-6-prefix-sets-and-lanes-reframed.md),
// a prefix is "good" iff its tip is a position from which a lane of the required
// length can be constructed. This scorer is the per-tile layer both the prefix
// generator and the lane-decomposition heuristics consume.
//
// v1 is deliberately a dumb linear combination of the existing starting-region
// annotations. The intent is NOT to produce a final scorer — it's to produce the
// simplest plausible signal we can wire end-to-end, so that downstream pressure
// (comparison runs, eyeballed heatmaps) tells us which ingredients matter.
//
// Formula:
//   score(tile) = rayDepth
//               + α * divergence
//               − β * (isArticulation ? 1 : 0)
//
// Dead-end nooks (§6 loose end from session 3) naturally dissolve here: they
// have low divergence AND low rayDepth, so their score is already small before
// the AP penalty lands. The AP penalty exists to push genuine choke tiles below
// otherwise-comparable open tiles.

interface TipScorerWeights {
  // Multiplier on outwardDivergence. Range of divergence is 0..3 in the
  // starting region, so α=2 gives it roughly half the weight of rayDepth for
  // a typical depth of ~10.
  divergence: number;
  // Subtractive penalty applied when the tile is a filtered articulation
  // point. β=3 knocks APs down enough to matter without dominating depth.
  articulation: number;
}

const DEFAULT_WEIGHTS: TipScorerWeights = {
  divergence: 2,
  articulation: 3,
};

interface TipScores {
  // Tile index → score. Only tiles in the starting region are present.
  scores: Map<number, number>;
  weights: TipScorerWeights;
  // Global stats for quick inspection.
  min: number;
  max: number;
  mean: number;
}

function scoreTile(
  tile: number,
  region: StartingRegion,
  weights: TipScorerWeights,
): number {
  const ann = region.annotations;
  const depth = ann.outwardRayDepth.get(tile) ?? 0;
  const div = ann.outwardDivergence.get(tile) ?? 0;
  const ap = ann.articulationPoints.has(tile) ? 1 : 0;
  return depth + weights.divergence * div - weights.articulation * ap;
}

function scoreStartingRegion(
  region: StartingRegion,
  weights: TipScorerWeights = DEFAULT_WEIGHTS,
): TipScores {
  const scores = new Map<number, number>();
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const tile of region.tiles) {
    const s = scoreTile(tile, region, weights);
    scores.set(tile, s);
    sum += s;
    if (s < min) min = s;
    if (s > max) max = s;
  }
  const mean = region.tiles.size > 0 ? sum / region.tiles.size : 0;
  return { scores, weights, min, max, mean };
}

// Return the top-K tiles by score, descending. Ties broken by ascending
// tile index for determinism.
function topKTiles(scores: TipScores, k: number): Array<{ tile: number; score: number }> {
  const entries = Array.from(scores.scores.entries()).map(([tile, score]) => ({
    tile,
    score,
  }));
  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.tile - b.tile;
  });
  return entries.slice(0, k);
}

export type { TipScorerWeights, TipScores };
export { DEFAULT_WEIGHTS, scoreStartingRegion, scoreTile, topKTiles };
