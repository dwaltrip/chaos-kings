import { countAbstractMovePatterns } from '../abstract-moves';
import type { AlgoConfig } from '../abstract-moves';

describe('countAbstractMovePatterns', () => {
  test('MAX_TICK = 10 produces 6 patterns', () => {
    // All 6 patterns (burst sizes, with firstMoveTick):
    //
    // 1a. 1, 1, 1, 1   bursts = 3,1 | 5,1 | 7,1 | 9,1
    // 1b. 1, 1, 2       bursts = 3,1 | 5,1 | 9,2
    // 1c. 1, 2, 1       bursts = 3,1 | 7,2 | 9,1
    //
    // 2a. 2, 1, 1       bursts = 5,2 | 7,1 | 9,1
    // 2b. 2, 2          bursts = 5,2 | 9,2
    //
    // 3a. 3, 1          bursts = 7,3 | 10,1
    const cfg: AlgoConfig = { maxTick: 10 };
    expect(countAbstractMovePatterns(cfg)).toBe(6);
  });

  test('MAX_TICK = 13 produces 14 patterns', () => {
    const cfg: AlgoConfig = { maxTick: 13 };
    expect(countAbstractMovePatterns(cfg)).toBe(14);
  });
});
