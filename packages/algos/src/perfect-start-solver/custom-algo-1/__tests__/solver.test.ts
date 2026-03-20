import { solve } from '../solver';
import { hasOverlap, popcount } from '../bitmask';

import { makeTestBoard } from './helpers';

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
  });

  it('maze-7x7 gets 24 captures with overlap', () => {
    const { board, generalPos } = makeTestBoard('maze-7x7');
    const result = solve(board, generalPos);

    expect(result.solution).not.toBeNull();
    expect(result.solution!.totalCaptured).toBe(24);
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
