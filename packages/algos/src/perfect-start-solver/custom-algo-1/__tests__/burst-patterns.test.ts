import { genDescendingPartitions, genValidBurstPatterns } from '../burst-patterns';
import { simulateOneBurst, type TimingState } from '../get-burst-info';

describe('genDescendingPartitions', () => {
  it('all partitions sum to target', () => {
    const target = 8;
    const partitions = genDescendingPartitions(target, target);
    for (const p of partitions) {
      expect(p.reduce((a, b) => a + b, 0)).toBe(target);
    }
  });

  it('all partitions are in descending order', () => {
    const partitions = genDescendingPartitions(10, 10);
    for (const p of partitions) {
      for (let i = 1; i < p.length; i++) {
        expect(p[i]).toBeLessThanOrEqual(p[i - 1]);
      }
    }
  });

  it('produces known counts for small values', () => {
    // Number of integer partitions: p(1)=1, p(2)=2, p(3)=3, p(4)=5, p(5)=7
    expect(genDescendingPartitions(1, 1)).toHaveLength(1);
    expect(genDescendingPartitions(2, 2)).toHaveLength(2);
    expect(genDescendingPartitions(3, 3)).toHaveLength(3);
    expect(genDescendingPartitions(4, 4)).toHaveLength(5);
    expect(genDescendingPartitions(5, 5)).toHaveLength(7);
  });

  it('respects maxVal constraint', () => {
    const partitions = genDescendingPartitions(6, 3);
    for (const p of partitions) {
      expect(Math.max(...p)).toBeLessThanOrEqual(3);
    }
    // All partitions of 6 with max element 3:
    // [3,3], [3,2,1], [3,1,1,1], [2,2,2], [2,2,1,1], [2,1,1,1,1], [1,1,1,1,1,1]
    expect(partitions).toHaveLength(7);
  });
});

describe('genValidBurstPatterns', () => {
  it('includes [10,8,4,2] for total=24', () => {
    const patterns = genValidBurstPatterns(24, 12, 50);
    const found = patterns.some(
      (p) => JSON.stringify(p) === JSON.stringify([10, 8, 4, 2]),
    );
    expect(found).toBe(true);
  });

  it('returns zero valid patterns for total=25 (cannot fit in 50 ticks)', () => {
    const patterns = genValidBurstPatterns(25, 12, 50);
    expect(patterns).toHaveLength(0);
  });

  it('all results fit within maxTicks', () => {
    const maxTicks = 50;
    const patterns = genValidBurstPatterns(20, 12, maxTicks);
    for (const pattern of patterns) {
      let state: TimingState = { tick: 1, generalTroops: 1 };
      let endTick = 0;
      for (const captures of pattern) {
        const result = simulateOneBurst(captures, captures, state, maxTicks);
        expect(result).not.toBeNull();
        endTick = result!.endTick;
        state = result!.nextState;
      }
      expect(endTick).toBeLessThanOrEqual(maxTicks);
    }
  });
});
