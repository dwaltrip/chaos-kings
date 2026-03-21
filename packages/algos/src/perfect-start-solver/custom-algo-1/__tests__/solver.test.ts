import {
  solveV3 as solve,
  bucketByMoveLenOverlap,
  BucketKey,
  type EntryWithMoves,
} from '../solver-v3';
import { hasOverlap, popcount } from '../bitmask';
import type { TimingEntry } from '../timing-table';

import { makeTestBoard } from './helpers';

function makeEntry(captures: number[], overlaps: number[]): EntryWithMoves {
  const entry: TimingEntry = { captures, overlaps, endTick: 50 };
  const moves = captures.map((c, i) => c + overlaps[i]);
  return { entry, moves };
}

describe('bucketByMoveLenOverlap', () => {
  it('groups entries by (moveLen, overlap) at given burstIdx', () => {
    const e1 = makeEntry([10, 8, 4], [0, 0, 0]); // burst1: moveLen=8, overlap=0
    const e2 = makeEntry([10, 8, 6], [0, 0, 0]); // burst1: moveLen=8, overlap=0
    const e3 = makeEntry([10, 4, 4], [0, 2, 0]); // burst1: moveLen=6, overlap=2

    const buckets = bucketByMoveLenOverlap([e1, e2, e3], 1);

    expect(buckets.size).toBe(2);
    // e1 and e2 share (8, 0)
    const key800 = BucketKey.pack(8, 0);
    expect(buckets.get(key800)).toEqual([e1, e2]);
    // e3 is (6, 2)
    const key602 = BucketKey.pack(6, 2);
    expect(buckets.get(key602)).toEqual([e3]);
  });

  it('returns empty map for empty input', () => {
    const buckets = bucketByMoveLenOverlap([], 0);
    expect(buckets.size).toBe(0);
  });

  it('single entry produces single bucket', () => {
    const e = makeEntry([12, 8], [0, 1]); // burst1: moveLen=9, overlap=1
    const buckets = bucketByMoveLenOverlap([e], 1);

    expect(buckets.size).toBe(1);
    const key = BucketKey.pack(9, 1);
    expect(buckets.get(key)).toEqual([e]);
  });
});

describe('solve', () => {
  it('open-7x7 gets 24 captures', () => {
    const { board, generalPos } = makeTestBoard('open-7x7');
    const result = solve(board, generalPos);

    expect(result.solution).not.toBeNull();
    expect(result.solution!.totalCaptured).toBe(24);
  });

  it('open-11x11 gets 24 captures', () => {
    const { board, generalPos } = makeTestBoard('open-11x11');
    const result = solve(board, generalPos);

    expect(result.solution).not.toBeNull();
    expect(result.solution!.totalCaptured).toBe(24);
  });

  it('corridor-7x7 gets 24 captures with overlap', () => {
    const { board, generalPos } = makeTestBoard('corridor-7x7');
    const result = solve(board, generalPos);

    expect(result.solution).not.toBeNull();
    expect(result.solution!.totalCaptured).toBe(24);
    const hasOverlapBurst = result.solution!.burstSpecs.some((s) => s.moves > s.captures);
    expect(hasOverlapBurst).toBe(true);
  });

  it('maze-7x7 gets 24 captures with overlap', () => {
    const { board, generalPos } = makeTestBoard('maze-7x7');
    const result = solve(board, generalPos);

    expect(result.solution).not.toBeNull();
    expect(result.solution!.totalCaptured).toBe(24);
    const hasOverlapBurst = result.solution!.burstSpecs.some((s) => s.moves > s.captures);
    expect(hasOverlapBurst).toBe(true);
  });

  it('corridor-7x7 without overlap gets fewer than 24', () => {
    const { board, generalPos } = makeTestBoard('corridor-7x7');
    const result = solve(board, generalPos, { maxOverlapPerBurst: 0 });

    expect(result.solution).not.toBeNull();
    expect(result.solution!.totalCaptured).toBeLessThan(24);
  });

  it('solution paths are non-overlapping (zero-overlap mode)', () => {
    const { board, generalPos } = makeTestBoard('open-11x11');
    const result = solve(board, generalPos, { maxOverlapPerBurst: 0 });
    expect(result.solution).not.toBeNull();
    const paths = result.solution!.paths;

    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        expect(hasOverlap(paths[i].mask, paths[j].mask)).toBe(false);
      }
    }
  });

  it('solution totalCaptured matches popcount of coveredMask', () => {
    const { board, generalPos } = makeTestBoard('open-7x7');
    const result = solve(board, generalPos);
    expect(result.solution).not.toBeNull();
    const s = result.solution!;

    let combined = 0n;
    for (const p of s.paths) combined |= p.mask;
    expect(combined).toBe(s.coveredMask);
    expect(popcount(combined)).toBe(s.totalCaptured);
  });

  it('solution burstSpecs match pattern and path lengths', () => {
    const { board, generalPos } = makeTestBoard('open-9x9');
    const result = solve(board, generalPos, { maxOverlapPerBurst: 0 });
    expect(result.solution).not.toBeNull();
    const s = result.solution!;

    expect(s.burstSpecs).toHaveLength(s.pattern.length);
    for (let i = 0; i < s.pattern.length; i++) {
      expect(s.burstSpecs[i].captures).toBe(s.pattern[i]);
      expect(s.burstSpecs[i].moves).toBe(s.paths[i].tiles.length);
      expect(s.burstSpecs[i].moves).toBeGreaterThanOrEqual(s.burstSpecs[i].captures);
    }
  });
});
