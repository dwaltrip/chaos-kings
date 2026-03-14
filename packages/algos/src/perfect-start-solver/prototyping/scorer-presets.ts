import {
  makeLandOnlyScorer,
  makeCapturableScorer,
  makeFrontierScorer,
  makeLandGenScorer,
  makeCapGenScorer,
  makeFrontierGenScorer,
} from './scoring-functions';
import type { TestBoard } from './test-boards';
import type { ScoringFn } from './types';

interface ScorerSpec {
  name: string;
  make: (board: TestBoard) => ScoringFn;
}

// -- Presets ------------------------------------------------------------------

// Established baselines + gen-aware experiments
const baselines: ScorerSpec[] = [
  { name: 'land-only', make: () => makeLandOnlyScorer() },
  { name: 'L1+cap', make: () => makeCapturableScorer() },
  { name: 'L5+cap', make: () => makeCapturableScorer({ landWeight: 5 }) },
  { name: 'frontier-2', make: () => makeFrontierScorer({ landWeight: 2 }) },
  { name: 'frontier-5', make: () => makeFrontierScorer({ landWeight: 5 }) },
];

// Cap/land weight sweep
const capWeightSweep: ScorerSpec[] = [
  { name: 'land-only', make: () => makeLandOnlyScorer() },
  { name: 'frontier-5', make: () => makeFrontierScorer({ landWeight: 5 }) },

  // Land weight sweep (cap=1)
  { name: 'L1+cap', make: () => makeCapturableScorer({ landWeight: 1 }) },
  { name: 'L2+cap', make: () => makeCapturableScorer({ landWeight: 2 }) },
  { name: 'L3+cap', make: () => makeCapturableScorer({ landWeight: 3 }) },
  { name: 'L5+cap', make: () => makeCapturableScorer({ landWeight: 5 }) },
  { name: 'L10+cap', make: () => makeCapturableScorer({ landWeight: 10 }) },

  // Cap weight sweep (land=5)
  { name: 'L5+cap2', make: () => makeCapturableScorer({ landWeight: 5, capWeight: 2 }) },
  { name: 'L5+cap3', make: () => makeCapturableScorer({ landWeight: 5, capWeight: 3 }) },

  // Mixed
  { name: 'L2+cap2', make: () => makeCapturableScorer({ landWeight: 2, capWeight: 2 }) },
  { name: 'L3+cap2', make: () => makeCapturableScorer({ landWeight: 3, capWeight: 2 }) },

  // Superlinear (excess²)
  {
    name: 'L5+sup',
    make: () => makeCapturableScorer({ landWeight: 5, superlinear: true }),
  },
  {
    name: 'L3+sup',
    make: () => makeCapturableScorer({ landWeight: 3, superlinear: true }),
  },
  {
    name: 'L2+sup',
    make: () => makeCapturableScorer({ landWeight: 2, superlinear: true }),
  },
];

// Gen-aware experiments
const genAware: ScorerSpec[] = [
  { name: 'L5+cap', make: () => makeCapturableScorer({ landWeight: 5 }) },
  { name: 'frontier-5', make: () => makeFrontierScorer({ landWeight: 5 }) },
  {
    name: 'cap+gen0.5',
    make: (b) => makeCapGenScorer({ generalCoord: b.generalCoord, genWeight: 0.5 }),
  },
  {
    name: 'cap+gen1',
    make: (b) => makeCapGenScorer({ generalCoord: b.generalCoord, genWeight: 1 }),
  },
  {
    name: 'cap+gen2',
    make: (b) => makeCapGenScorer({ generalCoord: b.generalCoord, genWeight: 2 }),
  },
  {
    name: 'land+gen0.5',
    make: (b) => makeLandGenScorer({ generalCoord: b.generalCoord, genWeight: 0.5 }),
  },
  {
    name: 'frontier+gen2',
    make: (b) => makeFrontierGenScorer({ generalCoord: b.generalCoord, genWeight: 2 }),
  },
];

// *** ACTIVE PRESET — change this line to switch ***
const activePreset = capWeightSweep;

export type { ScorerSpec };
export { activePreset };
