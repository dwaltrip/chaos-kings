import { genPathsDP } from '../gen-paths';
import { buildPathEntries, findPaths } from '../path-search';
import { tilesToMask, popcount } from '../bitmask';

import { makeTestBoard } from './helpers';

describe('buildPathEntries', () => {
  it('strips general tile and re-keys by new length', () => {
    const { board, generalPos } = makeTestBoard('open-7x7');
    const genPaths = genPathsDP(board, generalPos, 5);
    const entries = buildPathEntries(genPaths);

    // genPaths has keys 1..5, buildPathEntries strips len=1 and shifts keys down
    expect(entries.has(0)).toBe(false);
    expect(entries.has(1)).toBe(true); // was len=2
    expect(entries.has(4)).toBe(true); // was len=5

    // Entry count should match: len k in entries = len k+1 in genPaths
    for (let k = 1; k <= 4; k++) {
      expect(entries.get(k)!.length).toBe(genPaths.get(k + 1)!.length);
    }
  });

  it('entry tiles do not include the general tile', () => {
    const { board, generalPos } = makeTestBoard('open-7x7');
    const genPaths = genPathsDP(board, generalPos, 4);
    const entries = buildPathEntries(genPaths);

    for (const [_len, entryList] of entries.entries()) {
      for (const entry of entryList) {
        expect(entry.tiles).not.toContain(generalPos);
      }
    }
  });

  it('entry masks exclude the general tile bit', () => {
    const { board, generalPos } = makeTestBoard('open-7x7');
    const genPaths = genPathsDP(board, generalPos, 4);
    const entries = buildPathEntries(genPaths);
    const generalBit = 1n << BigInt(generalPos);

    for (const [_len, entryList] of entries.entries()) {
      for (const entry of entryList) {
        expect(entry.mask & generalBit).toBe(0n);
      }
    }
  });
});

describe('findPaths', () => {
  it('finds a solution on open-11x11 with [10,8,4,2]', () => {
    const { board, generalPos } = makeTestBoard('open-11x11');
    const genPaths = genPathsDP(board, generalPos, 11);
    const entries = buildPathEntries(genPaths);

    const result = findPaths(entries, [10, 8, 4, 2]);
    expect(result).not.toBeNull();
    expect(result!.paths).toHaveLength(4);
    expect(popcount(result!.coveredMask)).toBe(24);
  });

  it('solution paths are non-overlapping', () => {
    const { board, generalPos } = makeTestBoard('open-11x11');
    const genPaths = genPathsDP(board, generalPos, 11);
    const entries = buildPathEntries(genPaths);

    const result = findPaths(entries, [10, 8, 4, 2]);
    expect(result).not.toBeNull();
    const { paths } = result!;
    // Pairwise AND should be zero
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        expect(paths[i].mask & paths[j].mask).toBe(0n);
      }
    }
  });

  it('returns null on corridor-7x7 with [10,8,4,2]', () => {
    const { board, generalPos } = makeTestBoard('corridor-7x7');
    const genPaths = genPathsDP(board, generalPos, 11);
    const entries = buildPathEntries(genPaths);

    const result = findPaths(entries, [10, 8, 4, 2]);
    expect(result).toBeNull();
  });
});
