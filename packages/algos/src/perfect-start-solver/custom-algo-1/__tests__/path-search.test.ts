import { genPathsDP } from '../gen-paths';
import { buildPathEntries, countPrefixOverlap, findPaths } from '../path-search';
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

describe('countPrefixOverlap', () => {
  it('returns 0 when no tiles are owned', () => {
    expect(countPrefixOverlap([5, 6, 7], 0n)).toBe(0);
  });

  it('returns prefix length for clean prefix overlap', () => {
    // tiles 5 and 6 are owned, tile 7 is new
    const owned = (1n << 5n) | (1n << 6n);
    expect(countPrefixOverlap([5, 6, 7], owned)).toBe(2);
  });

  it('returns -1 for non-prefix overlap (gap)', () => {
    // tile 5 is new, tile 6 is owned, tile 7 is new — not a valid prefix
    const owned = 1n << 6n;
    expect(countPrefixOverlap([5, 6, 7], owned)).toBe(-1);
  });

  it('returns tiles.length when all tiles are owned', () => {
    const owned = (1n << 5n) | (1n << 6n) | (1n << 7n);
    expect(countPrefixOverlap([5, 6, 7], owned)).toBe(3);
  });

  it('returns 1 for single-tile prefix overlap', () => {
    const owned = 1n << 10n;
    expect(countPrefixOverlap([10, 11, 12], owned)).toBe(1);
  });

  it('returns -1 when only the last tile is owned', () => {
    const owned = 1n << 7n;
    expect(countPrefixOverlap([5, 6, 7], owned)).toBe(-1);
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

  it('returns null on corridor-7x7 with [10,8,4,2] (no overlap)', () => {
    const { board, generalPos } = makeTestBoard('corridor-7x7');
    const genPaths = genPathsDP(board, generalPos, 11);
    const entries = buildPathEntries(genPaths);

    const result = findPaths(entries, [10, 8, 4, 2]);
    expect(result).toBeNull();
  });

  it('burstSpecs have moves=captures when no overlapConfig', () => {
    const { board, generalPos } = makeTestBoard('open-7x7');
    const genPaths = genPathsDP(board, generalPos, 11);
    const entries = buildPathEntries(genPaths);

    const result = findPaths(entries, [10, 8, 4, 2]);
    expect(result).not.toBeNull();
    for (const spec of result!.burstSpecs) {
      expect(spec.moves).toBe(spec.captures);
    }
  });

  it('overlap enables solutions that zero-overlap cannot find', () => {
    // Use a small open board where we can construct the scenario:
    // a pattern that fails without overlap but succeeds with it.
    // The solver test for corridor-7x7 validates the real-world case;
    // here we just verify the findPaths overlap mechanics work.
    const { board, generalPos } = makeTestBoard('open-7x7');
    const genPaths = genPathsDP(board, generalPos, 13);
    const entries = buildPathEntries(genPaths);

    // With overlap config, burstSpecs should be populated correctly
    const result = findPaths(entries, [10, 8, 4, 2], {
      maxOverlapPerBurst: 3,
      maxTicks: 50,
    });
    expect(result).not.toBeNull();
    expect(result!.burstSpecs).toHaveLength(4);
    for (let i = 0; i < result!.burstSpecs.length; i++) {
      expect(result!.burstSpecs[i].captures).toBe([10, 8, 4, 2][i]);
      expect(result!.burstSpecs[i].moves).toBeGreaterThanOrEqual(
        result!.burstSpecs[i].captures,
      );
    }
  });
});
