// Tested gen-aware, superlinear, and cap/land weight sweeps — none broke 24 land.
// Most gen-aware and superlinear variants were degenerate (1-12 land) — the beam
// fills with hoarding states that never spend their armies. frontier-5 is the
// overall best scorer. Cap weight and land weight above ~3 are interchangeable.
// Full results: dev-notes/2026-03/3-13-[8]-scorer-experiments-report.md

import {
  makeLandOnlyScorer,
  makeCapturableScorer,
  makeFrontierScorer,
} from './scoring-functions';
import type { TestBoard } from './test-boards';
import type { ScoringFn } from './types';

interface ScorerSpec {
  name: string;
  make: (board: TestBoard) => ScoringFn;
}

// -- Presets ------------------------------------------------------------------

const baselines: ScorerSpec[] = [
  { name: 'land-only', make: () => makeLandOnlyScorer() },
  { name: 'L5+cap', make: () => makeCapturableScorer({ landWeight: 5 }) },
  { name: 'frontier-2', make: () => makeFrontierScorer({ landWeight: 2 }) },
  { name: 'frontier-5', make: () => makeFrontierScorer({ landWeight: 5 }) },
];

// L1 collapses at beam>=200. L2 is the lowest land weight that works —
// useful if we improve the capturable formula and want to see cap's influence.
const extraVariants: ScorerSpec[] = [
  { name: 'L1+cap', make: () => makeCapturableScorer() },
  { name: 'L2+cap', make: () => makeCapturableScorer({ landWeight: 2 }) },
];

// *** ACTIVE PRESET — change this line to switch ***
const activePreset = baselines;

export type { ScorerSpec };
export { activePreset, baselines, extraVariants };
