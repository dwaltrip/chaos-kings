// Follow-up to 1.3: path distribution by starting neighbor
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/3.20-1-neighbor-distribution.ts

import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { genPathsDP } from '../../custom-algo-1/gen-paths';
import { buildPathEntries } from '../../custom-algo-1/path-search';
import { allBoards } from '../../test-boards';

const MAX_LEN = 13;

function pad(s: string | number, width: number): string {
  return String(s).padStart(width);
}

function main() {
  const boards = allBoards();

  for (const testBoard of boards) {
    const board = fromBoardState(testBoard.board, 1);
    const generalPos = Board.toIndex(
      board,
      testBoard.generalCoord.x,
      testBoard.generalCoord.y,
    );

    const genPaths = genPathsDP(board, generalPos, MAX_LEN);
    const entriesByLen = buildPathEntries(genPaths);

    // Identify neighbors (tiles[0] values at length 1)
    const len1 = entriesByLen.get(1) ?? [];
    const neighbors = [...new Set(len1.map((e) => e.tiles[0]))].sort((a, b) => a - b);

    // Convert neighbor indices to (x,y) for readability
    const neighborLabels = neighbors.map((n) => {
      const x = n % board.width;
      const y = Math.floor(n / board.width);
      return `(${x},${y})`;
    });

    console.log(`\n=== ${testBoard.name} (${neighbors.length} neighbors) ===`);
    const header =
      ' Len | Total  | ' + neighborLabels.map((l) => l.padStart(8)).join(' | ');
    console.log(header);
    console.log('-'.repeat(header.length));

    let totalByNeighbor = new Map<number, number>();
    let grandTotal = 0;

    for (let len = 1; len <= 12; len++) {
      const entries = entriesByLen.get(len);
      if (!entries || entries.length === 0) continue;

      // Count paths by starting neighbor
      const counts = new Map<number, number>();
      for (const n of neighbors) counts.set(n, 0);

      for (const e of entries) {
        const start = e.tiles[0];
        counts.set(start, (counts.get(start) ?? 0) + 1);
      }

      grandTotal += entries.length;
      for (const [n, c] of counts) {
        totalByNeighbor.set(n, (totalByNeighbor.get(n) ?? 0) + c);
      }

      const cols = neighbors.map((n) => {
        const count = counts.get(n) ?? 0;
        const pct =
          entries.length > 0 ? ((count / entries.length) * 100).toFixed(0) : '0';
        return `${pad(count, 5)} ${pad(pct, 2)}%`;
      });

      console.log(` ${pad(len, 3)} |${pad(entries.length, 7)} | ${cols.join(' | ')}`);
    }

    // Totals row
    const totalCols = neighbors.map((n) => {
      const count = totalByNeighbor.get(n) ?? 0;
      const pct = grandTotal > 0 ? ((count / grandTotal) * 100).toFixed(0) : '0';
      return `${pad(count, 5)} ${pad(pct, 2)}%`;
    });
    console.log('-'.repeat(header.length));
    console.log(` ALL |${pad(grandTotal, 7)} | ${totalCols.join(' | ')}`);
  }
}

main();
