import { describe, it, expect } from 'vitest';

import { tilesEqual } from '../tile-data';
import { makeTileData } from './helpers';

describe('tilesEqual', () => {
  it('returns true for identical tile data', () => {
    const a = makeTileData();
    const b = makeTileData();
    expect(tilesEqual(a, b)).toBe(true);
  });

  it('returns false when any field differs', () => {
    const a = makeTileData({ armyCount: 5 });
    const b = makeTileData({ armyCount: 10 });
    expect(tilesEqual(a, b)).toBe(false);

    const c = makeTileData({ queuedUp: true });
    const d = makeTileData({ queuedUp: false });
    expect(tilesEqual(c, d)).toBe(false);
  });
});
