// Standalone CLI wrapper around renderBoard.
//
// Useful for quick board inspections from the terminal without writing a
// throwaway script each time. Supports:
//   - loading any board by name
//   - optional crop (centered on the general, by radius)
//   - a generic highlight list (comma-separated tile indices, or "x,y" pairs
//     separated by semicolons)
//   - optional numbered-groups highlight (semicolon-separated lists, each
//     list rendered with a distinct 1/2/3… label; useful for prefix sets)
//
// Examples:
//   tools/run-from-algos.sh render-board-cli.ts --board pocket-11x11
//
//   ... --board 3.21-real-board-tight-corner-1 --crop-radius 8
//
//   ... --board pocket-11x11 --highlight "10,8;9,8;8,8"
//
//   ... --board corner-13x13 --groups "1,2;1,3;2,3 | 3,1;3,2"
//     (two groups — first tile in each group gets its label, shared tiles get *)

import { Board, type FlatBoard } from '@core-next/flat-board';
import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import { loadBoardCtx } from './board';
import { renderBoard } from './render-board';

interface Options {
  board: string;
  cropRadius: string;
  highlight: string;
  groups: string;
  distance: boolean;
}

const { opts } = parseTypedCommand(
  createTypedCommand<Options>()
    .name('render-board-cli')
    .description('Render a test board as ASCII with optional overlays')
    .requiredOption('--board <name>', 'board name')
    .option('--crop-radius <n>', 'crop radius around general (default: no crop)', '')
    .option(
      '--highlight <list>',
      'comma-separated tile indices OR "x,y" pairs separated by semicolons',
      '',
    )
    .option(
      '--groups <spec>',
      'groups of tiles separated by " | "; each group is comma-separated "x,y" pairs separated by semicolons. First 9 groups get labels 1-9, shared tiles get *',
      '',
    )
    .option('--distance', 'overlay BFS distance from general (0-9, A-Z)', false),
);

function parseCoordList(spec: string, board: FlatBoard): number[] {
  // Accept either comma-separated indices "1,2,3" OR semicolon-separated
  // x,y pairs "10,8;9,8;8,8".
  const trimmed = spec.trim();
  if (!trimmed) return [];
  // Heuristic: if it contains ';', treat as x,y pairs.
  if (trimmed.includes(';')) {
    const pairs = trimmed
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    return pairs.map((pair) => {
      const [xs, ys] = pair.split(',').map((s) => s.trim());
      const x = Number(xs);
      const y = Number(ys);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`bad x,y pair: "${pair}"`);
      }
      return Board.toIndex(board, x, y);
    });
  }
  // Otherwise: comma-separated indices.
  return trimmed.split(',').map((s) => {
    const n = Number(s.trim());
    if (!Number.isFinite(n)) throw new Error(`bad tile index: "${s}"`);
    return n;
  });
}

function parseGroups(spec: string, board: FlatBoard): number[][] {
  const trimmed = spec.trim();
  if (!trimmed) return [];
  return trimmed
    .split('|')
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) => parseCoordList(g, board));
}

function computeBfsDistances(board: FlatBoard, start: number): Map<number, number> {
  const dist = new Map<number, number>();
  dist.set(start, 0);
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const d = dist.get(cur)!;
    const neighbors = [
      Board.neighborUp(board, cur),
      Board.neighborDown(board, cur),
      Board.neighborLeft(board, cur),
      Board.neighborRight(board, cur),
    ];
    for (const n of neighbors) {
      if (n < 0) continue;
      if (!Board.isPassable(board, n)) continue;
      if (dist.has(n)) continue;
      dist.set(n, d + 1);
      queue.push(n);
    }
  }
  return dist;
}

function groupLabel(bi: number): string {
  if (bi < 9) return String(bi + 1);
  return String.fromCharCode('A'.charCodeAt(0) + bi - 9);
}

function main(): void {
  const { flatBoard: board, generalPos } = loadBoardCtx(opts.board);
  const { x: gx, y: gy } = Board.toXY(board, generalPos);

  const highlights = new Set(parseCoordList(opts.highlight, board));

  const groupTiles = parseGroups(opts.groups, board);
  const groupOwner = new Map<number, number>();
  const shared = new Set<number>();
  for (let gi = 0; gi < groupTiles.length; gi++) {
    for (const t of groupTiles[gi]) {
      if (groupOwner.has(t)) shared.add(t);
      else groupOwner.set(t, gi);
    }
  }

  const distance = opts.distance ? computeBfsDistances(board, generalPos) : null;

  const cropRadius = opts.cropRadius ? Number(opts.cropRadius) : null;
  const crop =
    cropRadius != null
      ? {
          kind: 'region' as const,
          xMin: Math.max(0, gx - cropRadius),
          xMax: Math.min(board.width - 1, gx + cropRadius),
          yMin: Math.max(0, gy - cropRadius),
          yMax: Math.min(board.height - 1, gy + cropRadius),
        }
      : undefined;

  console.log(`=== ${opts.board} ===`);
  console.log(
    `size: ${board.width}x${board.height}  general: (${gx},${gy}) @ idx ${generalPos}`,
  );
  if (groupTiles.length > 0) {
    console.log(`groups: ${groupTiles.length} (shared tiles rendered as *)`);
  }
  if (highlights.size > 0) {
    console.log(`highlights: ${highlights.size} tiles (rendered as *)`);
  }
  console.log();

  const output = renderBoard(board, {
    crop,
    tileChar: (idx) => {
      if (idx === generalPos) return 'G';
      if (shared.has(idx)) return '*';
      const gi = groupOwner.get(idx);
      if (gi != null) return groupLabel(gi);
      if (highlights.has(idx)) return '*';
      if (distance != null) {
        const d = distance.get(idx);
        if (d == null) return null;
        if (d < 10) return String(d);
        return String.fromCharCode('A'.charCodeAt(0) + (d - 10));
      }
      return null;
    },
  });

  console.log(output);
}

main();
