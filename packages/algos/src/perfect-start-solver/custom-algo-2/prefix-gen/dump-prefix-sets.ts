// Generate and render top-K prefix sets for a given board + profile.
//
// The point is to eyeball what the generator is actually producing before
// feeding it into the comparison harness. Parameters (prefix lengths,
// overlap budget, scorer weights) will need fiddling; this CLI is the
// tight-loop tool for doing that.
//
// Examples:
//   tools/run-from-algos.sh packages/algos/src/perfect-start-solver/prefix-gen/dump-prefix-sets.ts \
//     --board pocket-11x11 --prefix-lengths 4,4 --max-overlap 1 --top-k 5
//
//   ... --board 3.21-real-board-tight-corner-1 --prefix-lengths 5,5 --max-overlap 2 --top-k 3
//
//   ... --board scattered-pockets-13x13 --prefix-lengths 3,3 --max-overlap 1 --top-k 5

import { Board, TileType, type FlatBoard } from '@core-next/flat-board';
import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import { loadBoardCtx } from '../../utils/board';
import { renderBoard } from '../../utils/render-board';

import { generatePrefixSets, type PrefixSet, type ScoreAggregator } from './generate';

interface Options {
  board: string;
  prefixLengths: string;
  maxOverlap: string;
  topK: string;
  maxIterations: string;
  aggregator: string;
  cropPad: string;
  showAll: boolean;
}

const { opts } = parseTypedCommand(
  createTypedCommand<Options>()
    .name('dump-prefix-sets')
    .description('Generate top-K prefix sets for a board and render each one')
    .requiredOption('--board <name>', 'board name')
    .option(
      '--prefix-lengths <list>',
      'comma-separated prefix length per burst, e.g. 4,3',
      '4,4',
    )
    .option(
      '--max-overlap <n>',
      '(sum lens - |union|); minimum = K-1 for forced general sharing',
      '',
    )
    .option('--top-k <n>', 'top K prefix-sets to keep', '5')
    .option('--max-iterations <n>', 'hard cap on combinations', '200000')
    .option('--aggregator <mode>', 'sum | min | max', 'sum')
    .option('--crop-pad <n>', 'crop padding around the prefix-set tiles', '2')
    .option('--show-all', 'render every top-K set (default: top 3)', false),
);

const prefixLengths = opts.prefixLengths.split(',').map((s) => Number(s.trim()));
if (prefixLengths.some((n) => !Number.isFinite(n) || n < 2)) {
  console.error(`bad --prefix-lengths: ${opts.prefixLengths}`);
  process.exit(1);
}
const K = prefixLengths.length;
const maxOverlap = opts.maxOverlap ? Number(opts.maxOverlap) : K - 1;
const topK = Number(opts.topK);
const maxIterations = Number(opts.maxIterations);
const aggregator = opts.aggregator as ScoreAggregator;
const cropPad = Number(opts.cropPad);
const showCount = opts.showAll ? topK : Math.min(3, topK);

function groupLabel(bi: number): string {
  if (bi < 9) return String(bi + 1);
  return String.fromCharCode('A'.charCodeAt(0) + bi - 9);
}

function renderPrefixSet(
  board: FlatBoard,
  general: number,
  set: PrefixSet,
  cropPadding: number,
): string {
  const tileOwner = new Map<number, number>();
  const shared = new Set<number>();
  for (let bi = 0; bi < set.prefixes.length; bi++) {
    for (const t of set.prefixes[bi].tiles) {
      if (t === general) continue;
      if (tileOwner.has(t)) shared.add(t);
      else tileOwner.set(t, bi);
    }
  }

  return renderBoard(board, {
    crop: { kind: 'tiles', tiles: set.unionTiles, padding: cropPadding },
    tileChar: (idx) => {
      if (idx === general) return 'G';
      if (shared.has(idx)) return '*';
      const bi = tileOwner.get(idx);
      if (bi != null) return groupLabel(bi);
      if (board.types[idx] === TileType.MOUNTAIN) return '#';
      return null;
    },
  });
}

function xy(board: FlatBoard, idx: number): string {
  const { x, y } = Board.toXY(board, idx);
  return `(${x},${y})`;
}

const { flatBoard: board, generalPos } = loadBoardCtx(opts.board);
console.log(`=== ${opts.board} ===`);
console.log(
  `general: ${xy(board, generalPos)}  K=${K}  prefixLengths=[${prefixLengths.join(',')}]  ` +
    `maxOverlap=${maxOverlap} (min=${K - 1})  agg=${aggregator}`,
);

const result = generatePrefixSets({
  board,
  general: generalPos,
  prefixLengths,
  maxOverlap,
  topK,
  maxIterations,
  aggregator,
});

console.log(
  `paths/burst: [${result.pathCountsPerBurst.join(', ')}]  ` +
    `iterations: ${result.iterations}${result.capped ? ' (CAPPED)' : ''}  ` +
    `sets: ${result.sets.length}  elapsed: ${result.elapsedMs}ms`,
);
console.log(
  `tip score stats: min=${result.tipScores.min} max=${result.tipScores.max} ` +
    `mean=${result.tipScores.mean.toFixed(1)}`,
);
console.log();

if (result.sets.length === 0) {
  console.log('no prefix-sets generated.');
  process.exit(0);
}

const shownSets = result.sets.slice(0, showCount);
for (let si = 0; si < shownSets.length; si++) {
  const set = shownSets[si];
  console.log(`--- set ${si + 1}/${shownSets.length} ---`);
  console.log(
    `  aggregateScore=${set.aggregateScore}  tipScores=[${set.tipScores.join(',')}]  ` +
      `overlap=${set.overlap}  |union|=${set.unionTiles.size}`,
  );
  for (let bi = 0; bi < set.prefixes.length; bi++) {
    const p = set.prefixes[bi];
    const path = p.tiles.map((t) => xy(board, t)).join('→');
    console.log(`  B${bi + 1} tip=${xy(board, p.tip)} (score=${p.tipScore}): ${path}`);
  }
  console.log();
  console.log(renderPrefixSet(board, generalPos, set, cropPad));
  console.log();
}
