// Compare blob sources: random-walk (session 2 baseline) vs. generated
// prefix-set blobs.
//
// The question this runner answers: for the 7-board session 2 matrix at a
// single burst profile, does feeding the lane-decomposition oracle blobs
// generated from high-scoring prefix tips produce different oracle
// feasibility than the session 2 random-walk blobs did?
//
// Under the session 3/4 reframe, the reframe's bet is that prefix tips
// with good lane-entry quality strand the frontier less often. The test
// is "swap in a better blob source and measure the oracle feasibility
// delta."
//
// Output: a per-board table of oracle-feasibility rates split by source,
// and a short summary of wins / losses / ties.
//
// Usage:
//   tools/run-from-algos.sh prefix-gen/compare-blob-sources.ts \
//     --profile 5,3 --prefix-lengths 2,3,4,5,6 --top-k 5

import * as fs from 'fs';
import * as path from 'path';

import { type FlatBoard } from '@core-next/flat-board';
import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import { genBlob, mulberry32 } from '../lane-decomp/blob-gen';
import { decompose } from '../lane-decomp/decompose';
import type { Blob, LaneRequest } from '../lane-decomp/types';
import {
  DEFAULT_WEIGHTS,
  scoreStartingRegion,
  type TipScorerWeights,
} from '../../starting-region/tip-scorer';
import { buildStartingRegion } from '../../starting-region/build';
import { loadBoardCtx } from '../../utils/board';

import { generatePrefixSets, type PrefixSet } from './generate';

// ── Board registry ────────────────────────────────────────────────────────

interface BoardSpec {
  name: string;
  regime: 'tight-toy' | 'tight-realistic' | 'less-constrained';
}

// Session 2 matrix — the original 7-board set. Default when --boards is
// omitted, so session 4 runs remain reproducible.
const SESSION2_MATRIX: BoardSpec[] = [
  { name: 'pocket-11x11', regime: 'tight-toy' },
  { name: 'scattered-pockets-13x13', regime: 'tight-toy' },
  { name: 'corner-13x13', regime: 'tight-toy' },
  { name: '3.21-real-board-tight-corner-1', regime: 'tight-realistic' },
  { name: '3-22.tight-edge-with-chokes', regime: 'tight-realistic' },
  { name: 'sparse-mtns-11x11', regime: 'less-constrained' },
  { name: '3.22-fairly-open', regime: 'less-constrained' },
];

// Session 5 Stage A additions — candidates for harder-board headroom probe.
// Most are tagged tight-realistic/tight-toy because the whole point is finding
// boards where random-walk blobs fail at meaningful rates.
const STAGE_A_ADDITIONS: BoardSpec[] = [
  // Unswept tight 25x25
  { name: '3.21-real-board-tight-corner-2', regime: 'tight-realistic' },
  { name: '3.21-real-board-semi-enclosed-region', regime: 'tight-realistic' },
  { name: '3.21-real-board-edge-choke-point', regime: 'tight-realistic' },
  // Unswept tight 30x30
  { name: '3.22-big-region-with-tight-choke', regime: 'tight-realistic' },
  { name: '3.22-small-corner-pocket', regime: 'tight-realistic' },
  { name: '3.22-semi-tight-near-corner', regime: 'tight-realistic' },
  // Simple degenerate-geometry
  { name: 'pocket-2-11x11', regime: 'tight-toy' },
  { name: 'narrow-corridors-11x11', regime: 'tight-toy' },
  { name: 'floating-corner-11x11', regime: 'tight-toy' },
  { name: 'edge-pocket-9x9', regime: 'tight-toy' },
  { name: 'edge-pocket-2-9x9', regime: 'tight-toy' },
  { name: 'island-11x11', regime: 'tight-toy' },
];

const BOARD_REGISTRY: BoardSpec[] = [...SESSION2_MATRIX, ...STAGE_A_ADDITIONS];

// Session 2 "reach-more" random-walk blob configs, by regime.
const BLOB_TOY = { pathCount: 5, maxLen: 6, minLen: 3, maxOverlap: 0 };
const BLOB_REALISTIC = { pathCount: 6, maxLen: 7, minLen: 4, maxOverlap: 0 };

const SEEDS = [1, 2, 3, 4];

// ── Options ───────────────────────────────────────────────────────────────

interface Options {
  profile: string;
  prefixLengths: string;
  topK: string;
  maxOverlap: string;
  maxIterations: string;
  aggregator: string;
  alpha: string;
  beta: string;
  variantLabel: string;
  output: string;
  boards: string;
  boardFilter: string;
  rwOnly: boolean;
  verbose: boolean;
}

const { opts } = parseTypedCommand(
  createTypedCommand<Options>()
    .name('compare-blob-sources')
    .description('Compare oracle feasibility across random-walk vs. generated blobs')
    .option('--profile <lanes>', 'comma-separated lane lengths, e.g. 5,3', '5,3')
    .option(
      '--prefix-lengths <list>',
      'comma-separated prefix lengths to sweep, e.g. 2,3,4,5,6',
      '2,3,4,5,6',
    )
    .option('--top-k <n>', 'top-K prefix-sets kept per (board, prefix length)', '5')
    .option(
      '--max-overlap <n>',
      'overlap budget (empty = auto: K-1 for lengths up to 3, K for longer)',
      '',
    )
    .option('--max-iterations <n>', 'generator iteration cap per call', '500000')
    .option('--aggregator <mode>', 'sum | min | max', 'sum')
    .option(
      '--alpha <n>',
      'scorer: divergence multiplier',
      String(DEFAULT_WEIGHTS.divergence),
    )
    .option(
      '--beta <n>',
      'scorer: articulation penalty',
      String(DEFAULT_WEIGHTS.articulation),
    )
    .option('--variant-label <str>', 'label for this run (included in summary/csv)', '')
    .option(
      '--output <dir>',
      'where to write CSV + summary (default: prefix-gen/output)',
      '',
    )
    .option(
      '--boards <list>',
      'csv of board names, "all" for full registry, omitted for session-2 matrix',
      '',
    )
    .option('--board-filter <substring>', 'only run boards whose name contains this', '')
    .option('--rw-only', 'skip generator; only run random-walk blobs', false)
    .option('--verbose', 'print per-cell details while running', false),
);

const profile = opts.profile.split(',').map((s) => Number(s.trim()));
if (profile.some((n) => !Number.isFinite(n) || n < 1)) {
  console.error(`bad --profile: ${opts.profile}`);
  process.exit(1);
}
const K = profile.length;
const prefixLengths = opts.prefixLengths.split(',').map((s) => Number(s.trim()));
if (prefixLengths.some((n) => !Number.isFinite(n) || n < 2)) {
  console.error(`bad --prefix-lengths: ${opts.prefixLengths}`);
  process.exit(1);
}
const topK = Number(opts.topK);
const maxIterations = Number(opts.maxIterations);
const aggregator = opts.aggregator as 'sum' | 'min' | 'max';
const userMaxOverlap = opts.maxOverlap ? Number(opts.maxOverlap) : null;
const scorerWeights: TipScorerWeights = {
  divergence: Number(opts.alpha),
  articulation: Number(opts.beta),
};

function resolveBoards(): BoardSpec[] {
  const arg = opts.boards.trim();
  if (!arg) return SESSION2_MATRIX;
  if (arg === 'all') return BOARD_REGISTRY;
  const requested = arg
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const resolved: BoardSpec[] = [];
  const missing: string[] = [];
  for (const name of requested) {
    const spec = BOARD_REGISTRY.find((b) => b.name === name);
    if (spec) resolved.push(spec);
    else missing.push(name);
  }
  if (missing.length > 0) {
    console.error(`unknown boards in --boards: ${missing.join(', ')}`);
    process.exit(1);
  }
  return resolved;
}

const BOARDS: BoardSpec[] = resolveBoards();

// ── Helpers ────────────────────────────────────────────────────────────────

interface BlobCell {
  source: string;
  label: string; // one-line description for CSV
  blob: Blob;
  aggregateScore?: number;
  prefixSet?: PrefixSet;
}

function unionToBlob(unionTiles: Set<number>): Blob {
  let mask = 0n;
  for (const t of unionTiles) mask |= 1n << BigInt(t);
  return { tiles: unionTiles, mask };
}

function prefixSetToBlob(set: PrefixSet): Blob {
  return { tiles: set.unionTiles, mask: set.unionMask };
}

function dedupByMask(cells: BlobCell[]): BlobCell[] {
  const seen = new Map<string, BlobCell>();
  for (const c of cells) {
    const key = c.blob.mask.toString();
    if (!seen.has(key)) seen.set(key, c);
  }
  return Array.from(seen.values());
}

function generateRandomWalkBlobs(
  spec: BoardSpec,
  board: FlatBoard,
  general: number,
): BlobCell[] {
  const params = spec.regime === 'tight-realistic' ? BLOB_REALISTIC : BLOB_TOY;
  const cells: BlobCell[] = [];
  for (const seed of SEEDS) {
    const rng = mulberry32(seed);
    const blob = genBlob({
      board,
      start: general,
      pathCount: params.pathCount,
      maxLen: params.maxLen,
      minLen: params.minLen,
      maxOverlap: params.maxOverlap,
      rng,
    });
    cells.push({
      source: 'random-walk',
      label: `rw-seed${seed}`,
      blob,
    });
  }
  return cells;
}

function generateGeneratedBlobs(
  board: FlatBoard,
  general: number,
  prefixLen: number,
): BlobCell[] {
  const region = buildStartingRegion(board, general);
  const tipScores = scoreStartingRegion(region, scorerWeights);

  const lengths = new Array(K).fill(prefixLen);
  // Overlap budget default: enough to let tight-by-tube boards produce
  // results on their degenerate geometries. A degree-2 general with 3
  // bursts needs overlap ≈ prefixLen per re-used direction. Setting the
  // default to (K-1) * (prefixLen - 1) allows any burst to fully overlap
  // any other burst's prefix up to length - 1 (excluding the tip). This
  // is generous — the scoring pressure + heap dedup by union mask is what
  // separates quality prefix-sets from degenerate ones.
  const autoMaxOverlap = (K - 1) * (prefixLen - 1);
  const maxOverlap = userMaxOverlap ?? autoMaxOverlap;
  if (maxOverlap < K - 1) return [];

  const result = generatePrefixSets({
    board,
    general,
    prefixLengths: lengths,
    maxOverlap,
    topK,
    maxIterations,
    aggregator,
    tipScores,
  });

  const cells: BlobCell[] = result.sets.map((set, i) => ({
    source: `gen-L${prefixLen}`,
    label: `gen-L${prefixLen}-rank${i + 1}-s${set.aggregateScore}`,
    blob: prefixSetToBlob(set),
    aggregateScore: set.aggregateScore,
    prefixSet: set,
  }));
  return cells;
}

// ── Evaluation ────────────────────────────────────────────────────────────

interface CellResult {
  board: string;
  regime: string;
  source: string;
  label: string;
  blobSize: number;
  frontierSize: number;
  oracleFeasible: boolean;
  oracleMs: number;
  aggregateScore: number | null;
}

function evalCell(
  spec: BoardSpec,
  board: FlatBoard,
  cell: BlobCell,
  requests: LaneRequest[],
): CellResult {
  const oracle = decompose({ board, blob: cell.blob, requests, maxDecomps: 1 });
  return {
    board: spec.name,
    regime: spec.regime,
    source: cell.source,
    label: cell.label,
    blobSize: cell.blob.tiles.size,
    frontierSize: oracle.stats.frontierSize,
    oracleFeasible: oracle.decompositions.length > 0,
    oracleMs: oracle.stats.elapsedMs,
    aggregateScore: cell.aggregateScore ?? null,
  };
}

function runMatrix(): CellResult[] {
  const requests: LaneRequest[] = profile.map((L) => ({ length: L }));
  const results: CellResult[] = [];
  const filter = opts.boardFilter.trim();

  for (const spec of BOARDS) {
    if (filter && !spec.name.includes(filter)) continue;
    const { flatBoard: board, generalPos } = loadBoardCtx(spec.name);

    const rwCells = generateRandomWalkBlobs(spec, board, generalPos);
    const genCells: BlobCell[] = [];
    if (!opts.rwOnly) {
      for (const L of prefixLengths) {
        genCells.push(...generateGeneratedBlobs(board, generalPos, L));
      }
    }
    const genDedup = dedupByMask(genCells);

    if (opts.verbose) {
      const genStr = opts.rwOnly
        ? 'gen=skipped'
        : `gen=${genCells.length} (dedup→${genDedup.length})`;
      console.log(`-- ${spec.name} -- rw=${rwCells.length} ${genStr}`);
    }

    for (const cell of rwCells) {
      const r = evalCell(spec, board, cell, requests);
      if (opts.verbose) logCell(r);
      results.push(r);
    }
    for (const cell of genDedup) {
      const r = evalCell(spec, board, cell, requests);
      if (opts.verbose) logCell(r);
      results.push(r);
    }
  }
  return results;
}

function logCell(r: CellResult): void {
  const mark = r.oracleFeasible ? '✓' : '✗';
  const score = r.aggregateScore != null ? ` score=${r.aggregateScore}` : '';
  console.log(
    `  ${mark} ${r.source.padEnd(12)} ${r.label.padEnd(30)} blob=${r.blobSize} front=${r.frontierSize}${score}`,
  );
}

// ── Summary ────────────────────────────────────────────────────────────────

interface SourceSummary {
  source: string;
  cells: number;
  feasible: number;
}

function summarizeSources(cells: CellResult[]): SourceSummary[] {
  const byKey = new Map<string, SourceSummary>();
  for (const c of cells) {
    // Collapse gen-L* into one group "generated" for the top-line compare,
    // and keep the per-L breakdown too.
    const keys = [c.source, c.source.startsWith('gen-') ? 'generated-any' : c.source];
    for (const k of keys) {
      const entry = byKey.get(k) ?? { source: k, cells: 0, feasible: 0 };
      entry.cells++;
      if (c.oracleFeasible) entry.feasible++;
      byKey.set(k, entry);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.source.localeCompare(b.source));
}

function fmtRate(num: number, denom: number): string {
  if (denom === 0) return 'n/a';
  return `${num}/${denom} (${Math.round((100 * num) / denom)}%)`;
}

function boardBestFeasible(cells: CellResult[], source: string): boolean {
  return cells.some((c) => c.source === source && c.oracleFeasible);
}

function boardBestFeasibleAnyGen(cells: CellResult[]): boolean {
  return cells.some((c) => c.source.startsWith('gen-') && c.oracleFeasible);
}

function markdownSummary(results: CellResult[]): string {
  const lines: string[] = [];
  const variant = opts.variantLabel ? ` — ${opts.variantLabel}` : '';
  const titleMode = opts.rwOnly ? ' (rw-only baseline probe)' : '';
  lines.push(
    `# Compare blob sources — profile [${profile.join(',')}]${variant}${titleMode}`,
  );
  lines.push('');
  if (!opts.rwOnly) {
    lines.push(
      `Prefix-length sweep: ${prefixLengths.join(',')}   top-K per (board, L): ${topK}   aggregator: ${aggregator}`,
    );
    lines.push(
      `Scorer weights: α(divergence)=${scorerWeights.divergence}  β(articulation)=${scorerWeights.articulation}`,
    );
  }
  lines.push(`Random-walk config: session 2 reach-more (seeds ${SEEDS.join(',')})`);
  lines.push(`Boards: ${BOARDS.length} (${BOARDS.map((b) => b.name).join(', ')})`);
  lines.push('');

  // Overall by source
  lines.push('## Overall by source');
  lines.push('');
  lines.push('| source | cells | feasible |');
  lines.push('|---|---|---|');
  for (const s of summarizeSources(results)) {
    lines.push(`| ${s.source} | ${s.cells} | ${fmtRate(s.feasible, s.cells)} |`);
  }
  lines.push('');

  if (opts.rwOnly) {
    // rw-only mode: focus on per-board rw feasibility, sorted to surface
    // the candidate "hard set" at the top.
    lines.push('## Per board — random-walk feasibility (sorted, hardest first)');
    lines.push('');
    lines.push('| board | regime | rw feasible | rw any✓ |');
    lines.push('|---|---|---|---|');
    const rows = BOARDS.map((spec) => {
      const cells = results.filter(
        (c) => c.board === spec.name && c.source === 'random-walk',
      );
      const feas = cells.filter((c) => c.oracleFeasible).length;
      return { spec, cells, feas };
    }).filter((r) => r.cells.length > 0);
    rows.sort((a, b) => a.feas - b.feas || a.spec.name.localeCompare(b.spec.name));
    for (const r of rows) {
      const any = r.feas > 0 ? '✓' : '✗';
      lines.push(
        `| ${r.spec.name} | ${r.spec.regime} | ${fmtRate(r.feas, r.cells.length)} | ${any} |`,
      );
    }
    lines.push('');

    // Candidate hard set: rw feasibility ≤ 50%.
    lines.push('## Candidate hard set (rw feasibility ≤ 50%)');
    lines.push('');
    const hard = rows.filter((r) => r.feas * 2 <= r.cells.length);
    if (hard.length === 0) {
      lines.push('(none — all boards too easy at this profile)');
    } else {
      for (const r of hard) {
        lines.push(`- ${r.spec.name} (${r.feas}/${r.cells.length})`);
      }
    }
    lines.push('');

    return lines.join('\n');
  }

  // Per board: "any feasible blob?" per source
  lines.push('## Per board — any feasible blob from this source?');
  lines.push(
    '(✓ = at least one cell from that source was oracle-feasible, ✗ = all cells failed)',
  );
  lines.push('');
  lines.push('| board | regime | rw any✓ | gen any✓ | delta |');
  lines.push('|---|---|---|---|---|');
  for (const spec of BOARDS) {
    const cells = results.filter((c) => c.board === spec.name);
    if (cells.length === 0) continue;
    const rwAny = boardBestFeasible(cells, 'random-walk');
    const genAny = boardBestFeasibleAnyGen(cells);
    const delta = rwAny === genAny ? '=' : rwAny ? 'rw only' : 'gen only';
    lines.push(
      `| ${spec.name} | ${spec.regime} | ${rwAny ? '✓' : '✗'} | ${genAny ? '✓' : '✗'} | ${delta} |`,
    );
  }
  lines.push('');

  // Per board, per source — how many blobs of each source were feasible
  lines.push('## Per board × source — cells feasible / total');
  lines.push('');
  const sources = ['random-walk', ...prefixLengths.map((L) => `gen-L${L}`)];
  lines.push('| board | ' + sources.join(' | ') + ' |');
  lines.push('|---|' + sources.map(() => '---').join('|') + '|');
  for (const spec of BOARDS) {
    const cells = results.filter((c) => c.board === spec.name);
    if (cells.length === 0) continue;
    const row = [spec.name];
    for (const src of sources) {
      const subset = cells.filter((c) => c.source === src);
      row.push(
        subset.length === 0
          ? '—'
          : `${subset.filter((c) => c.oracleFeasible).length}/${subset.length}`,
      );
    }
    lines.push('| ' + row.join(' | ') + ' |');
  }
  lines.push('');

  // Disagreement highlights
  lines.push('## Boards where generated beat random-walk');
  const genWins = BOARDS.filter((spec) => {
    const cells = results.filter((c) => c.board === spec.name);
    if (cells.length === 0) return false;
    return !boardBestFeasible(cells, 'random-walk') && boardBestFeasibleAnyGen(cells);
  });
  if (genWins.length === 0) lines.push('(none)');
  for (const spec of genWins) lines.push(`- ${spec.name}`);
  lines.push('');

  lines.push('## Boards where random-walk beat generated');
  const rwWins = BOARDS.filter((spec) => {
    const cells = results.filter((c) => c.board === spec.name);
    if (cells.length === 0) return false;
    return boardBestFeasible(cells, 'random-walk') && !boardBestFeasibleAnyGen(cells);
  });
  if (rwWins.length === 0) lines.push('(none)');
  for (const spec of rwWins) lines.push(`- ${spec.name}`);
  lines.push('');

  return lines.join('\n');
}

function toCsv(results: CellResult[]): string {
  const headers = [
    'board',
    'regime',
    'source',
    'label',
    'blob_size',
    'frontier_size',
    'oracle_feasible',
    'oracle_ms',
    'aggregate_score',
  ];
  const rows = [headers.join(',')];
  for (const r of results) {
    rows.push(
      [
        r.board,
        r.regime,
        r.source,
        r.label,
        r.blobSize,
        r.frontierSize,
        r.oracleFeasible ? 1 : 0,
        r.oracleMs,
        r.aggregateScore ?? '',
      ].join(','),
    );
  }
  return rows.join('\n') + '\n';
}

// ── Main ───────────────────────────────────────────────────────────────────

const t0 = Date.now();
console.log(
  `profile=[${profile.join(',')}]  prefix-lengths=[${prefixLengths.join(',')}]  top-K=${topK}  agg=${aggregator}`,
);
const results = runMatrix();
console.log(`done in ${Date.now() - t0}ms, ${results.length} cells`);
console.log();
const summary = markdownSummary(results);
console.log(summary);

const outputDir = opts.output || path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const now = new Date();
const ts =
  `${now.getMonth() + 1}.${String(now.getDate()).padStart(2, '0')}` +
  `-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

const csvPath = path.join(outputDir, `${ts}-compare-blob-sources.csv`);
fs.writeFileSync(csvPath, toCsv(results));
console.log(`wrote ${path.relative(process.cwd(), csvPath)}`);

const mdPath = path.join(outputDir, `${ts}-compare-blob-sources-summary.md`);
fs.writeFileSync(mdPath, summary);
console.log(`wrote ${path.relative(process.cwd(), mdPath)}`);
