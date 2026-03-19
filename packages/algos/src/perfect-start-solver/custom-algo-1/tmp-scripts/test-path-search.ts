import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { makeBoard } from '../../test-boards';
import { genPathsDP } from '../gen-paths';
import { buildPathEntries, findPaths } from '../path-search';
import { popcount, maskToTiles } from '../bitmask';

const burstPattern = [10, 8, 4, 2];
const maxBurstLen = Math.max(...burstPattern);

const boardNames = [
  'corridor-7x7',
  'sparse-mtns-7x7',
  'sparse-mtns-9x9',
  'sparse-mtns-11x11',
];

for (const name of boardNames) {
  const testBoard = makeBoard(name);
  const board = fromBoardState(testBoard.board, 1);
  const generalIdx = Board.toIndex(
    board,
    testBoard.generalCoord.x,
    testBoard.generalCoord.y,
  );

  console.log(`=== ${testBoard.name} (${board.width}x${board.height}) ===`);
  console.log(
    `General: idx=${generalIdx} (${testBoard.generalCoord.x},${testBoard.generalCoord.y})`,
  );
  console.log(`Burst pattern: ${JSON.stringify(burstPattern)}`);

  // generate paths (length includes general tile, so +1)
  const pathsByLen = genPathsDP(board, generalIdx, maxBurstLen + 1);

  const entries = buildPathEntries(pathsByLen);

  console.log('Path entries (general stripped):');
  for (const [k, e] of entries.entries()) {
    console.log(`  len ${k}: ${e.length} entries`);
  }

  const t0 = performance.now();
  const result = findPaths(entries, burstPattern);
  const elapsed = performance.now() - t0;

  if (!result) {
    console.log(`No solution found. (${elapsed.toFixed(1)}ms)`);
  } else {
    console.log(`Found solution in ${elapsed.toFixed(1)}ms`);
    console.log(`Total tiles covered: ${popcount(result.coveredMask)}`);

    console.log('Per-burst stats:');
    for (let i = 0; i < burstPattern.length; i++) {
      const s = result.stats.perBurst[i];
      const total = entries.get(burstPattern[i])?.length ?? 0;
      console.log(
        `  burst ${i + 1} (len ${burstPattern[i]}):  ${total} candidates, ${s.overlapSkips} overlap skips, ${s.tried} tried`,
      );
    }

    console.log('Solution:');
    for (let i = 0; i < result.paths.length; i++) {
      const p = result.paths[i];
      // const tiles = maskToTiles(p.mask);
      const coords = p.tiles.map((t) => {
        const x = t % board.width;
        const y = Math.floor(t / board.width);
        return `(${x},${y})`;
      });
      console.log(`  burst ${i + 1} (len ${burstPattern[i]}): ${coords.join(' ')}`);
    }
  }

  console.log();
}
