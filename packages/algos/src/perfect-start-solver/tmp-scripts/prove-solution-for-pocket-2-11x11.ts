import { Direction } from '@core/types';
import { analyzePattern, loadBoardCtx, printAnalysis } from '../utils/burst-pattern';

const L = Direction.LEFT,
  U = Direction.UP,
  D = Direction.DOWN;

// 11 goes straight left
// 6 goes left 3 then straight up
// 5 goes left 2, down, then left
// 4 goes left 1, down 2, left
// 3 goes straight down
const pattern = [
  { armies: 11, segments: [{ dir: L, count: 10 }] },
  {
    armies: 6,
    segments: [
      { dir: L, count: 3 },
      { dir: U, count: 5 },
    ],
  },
  {
    armies: 5,
    segments: [
      { dir: L, count: 2 },
      { dir: D, count: 1 },
      { dir: L, count: 3 },
    ],
  },
  {
    armies: 4,
    segments: [
      { dir: L, count: 1 },
      { dir: D, count: 2 },
      { dir: L, count: 1 },
    ],
  },
  { armies: 3, segments: [{ dir: D, count: 2 }] },
];

const ctx = loadBoardCtx('pocket-2-11x11');
const result = analyzePattern(ctx, pattern, 50);

if (result) {
  printAnalysis(result, { verbose: true });
} else {
  console.log('No result.');
}
