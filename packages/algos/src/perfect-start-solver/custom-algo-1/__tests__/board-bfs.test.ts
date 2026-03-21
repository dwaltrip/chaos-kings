import { popcount } from '../bitmask';
import { bfsCumulativeMasks } from '../board-bfs';

import { makeTestBoard } from './helpers';

describe('bfsCumulativeMasks', () => {
  it('distance 0 contains only the frontier tiles', () => {
    const { board, generalPos } = makeTestBoard('open-7x7');
    const masks = bfsCumulativeMasks(board, [generalPos], 3);

    expect(popcount(masks[0])).toBe(1);
    expect(masks[0]).toBe(1n << BigInt(generalPos));
  });

  it('distance 1 from center of open board has 5 tiles (center + 4 neighbors)', () => {
    const { board, generalPos } = makeTestBoard('open-7x7');
    const masks = bfsCumulativeMasks(board, [generalPos], 1);

    expect(popcount(masks[1])).toBe(5);
    // Must include the frontier tile itself
    expect(masks[1] & masks[0]).toBe(masks[0]);
  });

  it('masks are cumulative (each distance includes all previous)', () => {
    const { board, generalPos } = makeTestBoard('open-9x9');
    const masks = bfsCumulativeMasks(board, [generalPos], 4);

    for (let d = 1; d <= 4; d++) {
      // Every tile in masks[d-1] must also be in masks[d]
      expect(masks[d] & masks[d - 1]).toBe(masks[d - 1]);
      // Cumulative count should not decrease
      expect(popcount(masks[d])).toBeGreaterThanOrEqual(popcount(masks[d - 1]));
    }
  });

  it('excludeTiles are never included in masks', () => {
    const { board, generalPos } = makeTestBoard('open-7x7');
    const excluded = generalPos + 1; // an adjacent tile
    const excludedBit = 1n << BigInt(excluded);

    const masks = bfsCumulativeMasks(board, [generalPos], 4, [excluded]);

    for (let d = 0; d <= 4; d++) {
      expect(masks[d] & excludedBit).toBe(0n);
    }
  });

  it('mountains block BFS expansion', () => {
    const { board, generalPos } = makeTestBoard('dense-mtns-9x9');
    const masksOpen = bfsCumulativeMasks(
      makeTestBoard('open-9x9').board,
      [generalPos],
      3,
    );
    const masksMtns = bfsCumulativeMasks(board, [generalPos], 3);

    // Mountains should reduce reachable tiles
    expect(popcount(masksMtns[3])).toBeLessThan(popcount(masksOpen[3]));
  });
});
