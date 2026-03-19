import { tilesToMask, maskToTiles, hasOverlap, popcount } from '../bitmask';

describe('tilesToMask', () => {
  it('returns 0n for empty array', () => {
    expect(tilesToMask([])).toBe(0n);
  });

  it('sets a single bit for one tile', () => {
    expect(tilesToMask([5])).toBe(1n << 5n);
  });

  it('sets multiple bits', () => {
    const mask = tilesToMask([0, 3, 7]);
    expect(mask).toBe((1n << 0n) | (1n << 3n) | (1n << 7n));
  });
});

describe('maskToTiles', () => {
  it('returns empty array for 0n', () => {
    expect(maskToTiles(0n)).toEqual([]);
  });

  it('roundtrips with tilesToMask', () => {
    const tiles = [1, 4, 10, 20];
    expect(maskToTiles(tilesToMask(tiles))).toEqual(tiles);
  });

  it('roundtrips unordered input (returns sorted)', () => {
    const tiles = [20, 4, 1, 10];
    expect(maskToTiles(tilesToMask(tiles))).toEqual([1, 4, 10, 20]);
  });
});

describe('hasOverlap', () => {
  it('returns true for overlapping masks', () => {
    const a = tilesToMask([1, 2, 3]);
    const b = tilesToMask([3, 4, 5]);
    expect(hasOverlap(a, b)).toBe(true);
  });

  it('returns false for non-overlapping masks', () => {
    const a = tilesToMask([1, 2, 3]);
    const b = tilesToMask([4, 5, 6]);
    expect(hasOverlap(a, b)).toBe(false);
  });

  it('returns false for two zero masks', () => {
    expect(hasOverlap(0n, 0n)).toBe(false);
  });
});

describe('popcount', () => {
  it('returns 0 for zero', () => {
    expect(popcount(0n)).toBe(0);
  });

  it('returns correct count for small values', () => {
    expect(popcount(0b1010n)).toBe(2);
    expect(popcount(0b1111n)).toBe(4);
    expect(popcount(0b1n)).toBe(1);
  });

  it('returns correct count for larger masks', () => {
    const tiles = [0, 5, 10, 15, 20, 25, 30];
    expect(popcount(tilesToMask(tiles))).toBe(7);
  });
});
