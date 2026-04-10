// Run the lane-decomposition prototype on a single test board.
//
// Usage:
//   tools/run-from-algos.sh src/perfect-start-solver/custom-algo-2/lane-decomp/run-lane-decomp.ts \
//     --board corner-9x9 --start 4,4 --blob-paths 4 --blob-max-len 4 --blob-min-len 2 \
//     --seed 1 --lanes 6,4,3 --max-decomps 100

import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import { Board } from '../../../core-next/flat-board';

import { loadBoardCtx } from '../../utils/board';
import { renderBoard } from '../../utils/render-board';

import { genBlob, mulberry32 } from './blob-gen';
import { decompose } from './decompose';
import type { Decomposition, LaneRequest } from './types';

interface Options {
  board: string;
  start: string;
  blobPaths: string;
  blobMaxLen: string;
  blobMinLen: string;
  blobOverlap: string;
  seed: string;
  lanes: string;
  maxDecomps: string;
  verbose: boolean;
}

const { opts } = parseTypedCommand(
  createTypedCommand<Options>()
    .name('run-lane-decomp')
    .description(
      'Lane decomposition prototype — generate a blob and exhaustively decompose',
    )
    .requiredOption('--board <name>', 'Board name')
    .option(
      '--start <spec>',
      'Start tile: "x,y" or tile index. Default: general position from board file',
      '',
    )
    .option('--blob-paths <n>', 'Number of constituent random paths in the blob', '4')
    .option('--blob-max-len <n>', 'Longest constituent path length', '4')
    .option('--blob-min-len <n>', 'Shortest constituent path length', '2')
    .option(
      '--blob-overlap <n>',
      'Per-path overlap budget (tiles a path may re-traverse)',
      '0',
    )
    .option('--seed <n>', 'PRNG seed for blob generation', '1')
    .requiredOption(
      '--lanes <list>',
      'Comma-separated lane lengths (descending), e.g. 6,4,3',
    )
    .option('--max-decomps <n>', 'Cap on decompositions reported', '100')
    .option('--verbose', 'Show multiple decompositions', false),
);

const { flatBoard: board, generalPos } = loadBoardCtx(opts.board);

function parseStart(spec: string): number {
  if (!spec) return generalPos;
  if (spec.includes(',')) {
    const [xs, ys] = spec.split(',');
    return Board.toIndex(board, Number(xs), Number(ys));
  }
  return Number(spec);
}

const start = parseStart(opts.start);
if (!Board.isPassable(board, start)) {
  console.error(`start tile ${start} is not passable`);
  process.exit(1);
}

const rng = mulberry32(Number(opts.seed));
const blob = genBlob({
  board,
  start,
  pathCount: Number(opts.blobPaths),
  maxLen: Number(opts.blobMaxLen),
  minLen: Number(opts.blobMinLen),
  maxOverlap: Number(opts.blobOverlap),
  rng,
});

const requests: LaneRequest[] = opts.lanes
  .split(',')
  .map((s) => ({ length: Number(s.trim()) }));
const maxDecomps = Number(opts.maxDecomps);

const result = decompose({ board, blob, requests, maxDecomps });

// ── Output ──

const laneLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function charForBlobView(idx: number): string | null {
  if (idx === start) return 'S';
  if (blob.tiles.has(idx)) return 'B';
  return null;
}

function charForDecomp(decomp: Decomposition): (idx: number) => string | null {
  // Precompute idx → lane label. Shared tiles (shouldn't happen in a valid
  // decomposition) get '*'.
  const tileOwner = new Map<number, number>();
  const shared = new Set<number>();
  for (let li = 0; li < decomp.length; li++) {
    for (const t of decomp[li].tiles) {
      if (tileOwner.has(t)) shared.add(t);
      else tileOwner.set(t, li);
    }
  }
  return (idx: number): string | null => {
    if (idx === start) return 'S';
    if (blob.tiles.has(idx)) return 'B';
    if (shared.has(idx)) return '*';
    if (tileOwner.has(idx)) return laneLabels[tileOwner.get(idx)!] ?? '?';
    return null;
  };
}

function cropTilesFor(decomp: Decomposition | null): number[] {
  const tiles: number[] = [...blob.tiles];
  if (decomp) {
    for (const lane of decomp) tiles.push(...lane.tiles);
  }
  return tiles;
}

console.log(`board: ${opts.board}  (${board.width}x${board.height})`);
console.log(
  `start: ${start}  (${start % board.width},${Math.floor(start / board.width)})  seed=${opts.seed}`,
);
console.log(
  `blob: ${blob.tiles.size} tiles  (paths=${opts.blobPaths}, max=${opts.blobMaxLen}, min=${opts.blobMinLen}, overlap=${opts.blobOverlap})`,
);
console.log();

console.log('# Blob');
console.log(
  renderBoard(board, {
    tileChar: charForBlobView,
    crop: { kind: 'tiles', tiles: blob.tiles, padding: 2 },
  }),
);
console.log();

const reqStr = requests.map((r) => r.length).join(',');
console.log(`lanes requested: [${reqStr}]`);
console.log(`frontier size: ${result.stats.frontierSize}`);
const candStrs: string[] = [];
for (const [len, n] of result.stats.candidatesByLength) {
  candStrs.push(`L${len}=${n}`);
}
console.log(`candidate lanes per length: ${candStrs.join('  ')}`);
console.log(
  `decompositions: ${result.decompositions.length}${result.capped ? ' (capped)' : ''}  in ${result.stats.elapsedMs}ms`,
);
console.log();

if (result.decompositions.length === 0) {
  console.log('(no valid decomposition found)');
} else {
  const showN = opts.verbose ? Math.min(5, result.decompositions.length) : 1;
  for (let i = 0; i < showN; i++) {
    const decomp = result.decompositions[i];
    console.log(`# Decomposition ${i + 1}`);
    for (let li = 0; li < decomp.length; li++) {
      const lane = decomp[li];
      const coords = lane.tiles
        .map((t) => `(${t % board.width},${Math.floor(t / board.width)})`)
        .join(' ');
      console.log(`  lane ${laneLabels[li]} (len ${lane.tiles.length}): ${coords}`);
    }
    console.log(
      renderBoard(board, {
        tileChar: charForDecomp(decomp),
        crop: { kind: 'tiles', tiles: cropTilesFor(decomp), padding: 1 },
      }),
    );
    console.log();
  }
}
