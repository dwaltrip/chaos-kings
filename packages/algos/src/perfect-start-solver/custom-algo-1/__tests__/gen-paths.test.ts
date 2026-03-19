import { genPathsDP } from '../gen-paths';

import { makeTestBoard } from './helpers';

describe('genPathsDP', () => {
  describe('open boards produce expected path counts', () => {
    it('open-7x7 center start', () => {
      const { board, generalPos } = makeTestBoard('open-7x7');
      const paths = genPathsDP(board, generalPos, 11);

      // Length 1 is just the start tile
      expect(paths.get(1)).toHaveLength(1);
      // Length 2: 4 neighbors
      expect(paths.get(2)).toHaveLength(4);
      // Length 3: each of 4 neighbors has 3 new neighbors = 12
      expect(paths.get(3)).toHaveLength(12);
    });

    it('open-11x11 center start path counts grow as expected', () => {
      const { board, generalPos } = makeTestBoard('open-11x11');
      const paths = genPathsDP(board, generalPos, 6);

      expect(paths.get(1)).toHaveLength(1);
      expect(paths.get(2)).toHaveLength(4);
      expect(paths.get(3)).toHaveLength(12);
      // Path counts should increase with length on an open board
      for (let k = 3; k <= 5; k++) {
        expect(paths.get(k + 1)!.length).toBeGreaterThan(paths.get(k)!.length);
      }
    });
  });

  describe('paths respect mountains', () => {
    it('sparse-mtns-7x7 has fewer paths than open-7x7', () => {
      const open = makeTestBoard('open-7x7');
      const sparse = makeTestBoard('sparse-mtns-7x7');

      const openPaths = genPathsDP(open.board, open.generalPos, 8);
      const sparsePaths = genPathsDP(sparse.board, sparse.generalPos, 8);

      // Mountains reduce available paths at longer lengths
      for (let k = 3; k <= 8; k++) {
        expect(sparsePaths.get(k)!.length).toBeLessThan(openPaths.get(k)!.length);
      }
    });
  });

  describe('all paths start from the given start tile', () => {
    it('every path begins with the start index', () => {
      const { board, generalPos } = makeTestBoard('open-7x7');
      const paths = genPathsDP(board, generalPos, 6);

      for (const [_len, pathList] of paths.entries()) {
        for (const path of pathList) {
          expect(path.tiles[0]).toBe(generalPos);
        }
      }
    });
  });

  describe('path tiles are unique within each path', () => {
    it('no repeated tiles in any path', () => {
      const { board, generalPos } = makeTestBoard('sparse-mtns-7x7');
      const paths = genPathsDP(board, generalPos, 6);

      for (const [_len, pathList] of paths.entries()) {
        for (const path of pathList) {
          const unique = new Set(path.tiles);
          expect(unique.size).toBe(path.tiles.length);
        }
      }
    });
  });
});
