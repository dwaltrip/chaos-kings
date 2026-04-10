// Session 4.10-2 — evaluate face projection + greedy longest-path against
// the exhaustive enumerator (oracle) on a fixed board / seed / profile matrix.
//
// Run:
//   tools/run-from-algos.sh \
//     src/perfect-start-solver/custom-algo-2/lane-decomp/evaluate-heuristics.ts
//
// Output (relative to this file):
//   output/{MM.DD-HHMM}-evaluate-heuristics.csv
//   output/{MM.DD-HHMM}-evaluate-heuristics-summary.md
//
// Oracle caveat: "exists" means "at these specific target lane lengths,
// the exhaustive enumerator finds at least one valid decomposition."
// It is NOT an absolute feasibility statement about the (board, blob).

import * as fs from 'fs';
import * as path from 'path';

import { loadBoardCtx } from '../../utils/board';

import { genBlob, mulberry32 } from './blob-gen';
import { decompose } from './decompose';
import { computeFaceProjection, faceProjectionFeasible } from './face-projection';
import { greedyDecompose } from './greedy-longest-path';
import type { LaneRequest } from './types';

// ── Matrix configuration ────────────────────────────────────────────────────

type Regime = 'tight-toy' | 'tight-realistic' | 'less-constrained';

interface BoardSpec {
  name: string;
  regime: Regime;
  blob: BlobParams;
}

interface BlobParams {
  pathCount: number;
  maxLen: number;
  minLen: number;
  maxOverlap: number;
}

// Blob params — "reach-more" config (session 4.10-2).
//
// Baseline run used smaller blobs (toy: 4/4/2, realistic: 6/5/3) which
// produced pathological frontier-in-pocket shapes on tight boards,
// causing spurious oracle-fails. These larger params give the blob
// enough reach to punch frontier tiles into open space, which is closer
// to what real prefix sets would produce. Still within D<=7 per path,
// which is in-range for actual burst lengths per burst segmentation.
const BLOB_TOY: BlobParams = { pathCount: 5, maxLen: 6, minLen: 3, maxOverlap: 0 };
const BLOB_REALISTIC: BlobParams = {
  pathCount: 6,
  maxLen: 7,
  minLen: 4,
  maxOverlap: 0,
};

const BOARDS: BoardSpec[] = [
  { name: 'pocket-11x11', regime: 'tight-toy', blob: BLOB_TOY },
  { name: 'scattered-pockets-13x13', regime: 'tight-toy', blob: BLOB_TOY },
  { name: 'corner-13x13', regime: 'tight-toy', blob: BLOB_TOY },
  {
    name: '3.21-real-board-tight-corner-1',
    regime: 'tight-realistic',
    blob: BLOB_REALISTIC,
  },
  {
    name: '3-22.tight-edge-with-chokes',
    regime: 'tight-realistic',
    blob: BLOB_REALISTIC,
  },
  { name: 'sparse-mtns-11x11', regime: 'less-constrained', blob: BLOB_TOY },
  { name: '3.22-fairly-open', regime: 'less-constrained', blob: BLOB_REALISTIC },
];

interface Profile {
  label: string;
  lanes: number[];
}

const PROFILES: Profile[] = [
  { label: 'short', lanes: [5, 3] },
  { label: 'medium', lanes: [6, 4, 3] },
  { label: 'long', lanes: [8, 6, 4] },
];

const SEEDS = [1, 2, 3, 4];

// ── Per-cell evaluation ────────────────────────────────────────────────────

interface CellResult {
  board: string;
  regime: Regime;
  seed: number;
  profile: string;
  k: number;
  lanes: number[];
  blobSize: number;
  frontierSize: number;
  oracleExists: boolean;
  oracleMs: number;
  faceFeasible: boolean;
  faceMs: number;
  greedyFound: boolean;
  greedyMs: number;
}

function evaluateCell(spec: BoardSpec, seed: number, profile: Profile): CellResult {
  const { flatBoard: board, generalPos } = loadBoardCtx(spec.name);
  const rng = mulberry32(seed);
  const blob = genBlob({
    board,
    start: generalPos,
    pathCount: spec.blob.pathCount,
    maxLen: spec.blob.maxLen,
    minLen: spec.blob.minLen,
    maxOverlap: spec.blob.maxOverlap,
    rng,
  });

  const requests: LaneRequest[] = profile.lanes.map((L) => ({ length: L }));

  // Oracle: does *any* decomposition exist at these lengths? Cap at 1.
  const oracle = decompose({ board, blob, requests, maxDecomps: 1 });
  const oracleExists = oracle.decompositions.length > 0;

  // Face projection.
  const faceStart = Date.now();
  const projection = computeFaceProjection(board, blob);
  const faceVerdict = faceProjectionFeasible(projection, profile.lanes);
  const faceMs = Date.now() - faceStart;

  // Greedy.
  const greedy = greedyDecompose(board, blob, profile.lanes);

  return {
    board: spec.name,
    regime: spec.regime,
    seed,
    profile: profile.label,
    k: profile.lanes.length,
    lanes: profile.lanes,
    blobSize: blob.tiles.size,
    frontierSize: oracle.stats.frontierSize,
    oracleExists,
    oracleMs: oracle.stats.elapsedMs,
    faceFeasible: faceVerdict.feasible,
    faceMs,
    greedyFound: greedy.found,
    greedyMs: greedy.elapsedMs,
  };
}

// ── Matrix sweep ───────────────────────────────────────────────────────────

function runMatrix(): CellResult[] {
  const results: CellResult[] = [];
  for (const spec of BOARDS) {
    for (const seed of SEEDS) {
      for (const profile of PROFILES) {
        results.push(evaluateCell(spec, seed, profile));
      }
    }
  }
  return results;
}

// ── CSV output ─────────────────────────────────────────────────────────────

function toCsv(results: CellResult[]): string {
  const headers = [
    'board',
    'regime',
    'seed',
    'profile',
    'k',
    'lanes',
    'blob_size',
    'frontier_size',
    'oracle_exists',
    'oracle_ms',
    'face_feasible',
    'face_ms',
    'greedy_found',
    'greedy_ms',
  ];
  const rows = [headers.join(',')];
  for (const r of results) {
    rows.push(
      [
        r.board,
        r.regime,
        r.seed,
        r.profile,
        r.k,
        `"${r.lanes.join(',')}"`,
        r.blobSize,
        r.frontierSize,
        r.oracleExists ? 1 : 0,
        r.oracleMs,
        r.faceFeasible ? 1 : 0,
        r.faceMs,
        r.greedyFound ? 1 : 0,
        r.greedyMs,
      ].join(','),
    );
  }
  return rows.join('\n') + '\n';
}

// ── Markdown summary ───────────────────────────────────────────────────────

interface SliceStats {
  cells: number;
  oracleExistsCount: number;
  greedyRecall: { found: number; of: number }; // greedy_found | oracle_exists
  facePrecision: { correct: number; of: number }; // oracle_exists | face_feasible
  faceRecall: { detected: number; of: number }; // face_feasible | oracle_exists
  faceFalsePositives: number; // face_feasible && !oracle_exists
  faceFalseNegatives: number; // !face_feasible && oracle_exists
  greedyMisses: number; // !greedy_found && oracle_exists
}

function sliceStats(cells: CellResult[]): SliceStats {
  const oracleExistsCount = cells.filter((c) => c.oracleExists).length;
  const greedyFoundGivenOracle = cells.filter(
    (c) => c.oracleExists && c.greedyFound,
  ).length;

  const faceFeasibleCount = cells.filter((c) => c.faceFeasible).length;
  const faceFeasibleAndOracle = cells.filter(
    (c) => c.faceFeasible && c.oracleExists,
  ).length;

  const faceFP = cells.filter((c) => c.faceFeasible && !c.oracleExists).length;
  const faceFN = cells.filter((c) => !c.faceFeasible && c.oracleExists).length;
  const greedyMisses = cells.filter((c) => c.oracleExists && !c.greedyFound).length;

  return {
    cells: cells.length,
    oracleExistsCount,
    greedyRecall: { found: greedyFoundGivenOracle, of: oracleExistsCount },
    facePrecision: { correct: faceFeasibleAndOracle, of: faceFeasibleCount },
    faceRecall: { detected: faceFeasibleAndOracle, of: oracleExistsCount },
    faceFalsePositives: faceFP,
    faceFalseNegatives: faceFN,
    greedyMisses,
  };
}

function fmtRate(num: number, denom: number): string {
  if (denom === 0) return 'n/a';
  return `${num}/${denom} (${Math.round((100 * num) / denom)}%)`;
}

function markdownSummary(results: CellResult[]): string {
  const lines: string[] = [];
  lines.push('# Session 4.10-2 — Face projection + greedy heuristics vs. oracle');
  lines.push('');
  lines.push(
    '**Oracle:** exhaustive enumerator capped at maxDecomps=1. ' +
      '`oracle_exists` = "at these specific target lane lengths, at least ' +
      'one valid non-overlapping decomposition exists on this (board, seed, blob)."',
  );
  lines.push('');
  lines.push(
    '**Face projection:** straight rays cast from each frontier tile in ' +
      'each cardinal direction, stopping at mountain/edge/blob. Feasibility ' +
      'check greedily assigns lanes (longest first) to frontier tiles (deepest ' +
      'first) by max-depth. One-sided: can only rule things out.',
  );
  lines.push('');
  lines.push(
    '**Greedy:** sort lanes by length descending; DFS a non-backtracking path ' +
      'of exact length from frontier tiles, avoiding blob + already-used tiles; ' +
      'first path found wins; no backtracking across lanes.',
  );
  lines.push('');

  // Overall
  lines.push('## Overall');
  const overall = sliceStats(results);
  lines.push(`- Cells: ${overall.cells}`);
  lines.push(`- Oracle exists: ${fmtRate(overall.oracleExistsCount, overall.cells)}`);
  lines.push(
    `- **Greedy recall** (greedy found | oracle exists): ${fmtRate(overall.greedyRecall.found, overall.greedyRecall.of)}`,
  );
  lines.push(
    `- Face recall (face feasible | oracle exists): ${fmtRate(overall.faceRecall.detected, overall.faceRecall.of)}`,
  );
  lines.push(
    `- Face precision (oracle exists | face feasible): ${fmtRate(overall.facePrecision.correct, overall.facePrecision.of)}`,
  );
  lines.push(`- Face false positives: ${overall.faceFalsePositives}`);
  lines.push(`- Face false negatives: ${overall.faceFalseNegatives}`);
  lines.push(`- Greedy misses: ${overall.greedyMisses}`);
  lines.push('');

  // Per regime
  lines.push('## By regime');
  const regimes: Regime[] = ['tight-toy', 'tight-realistic', 'less-constrained'];
  for (const r of regimes) {
    const cells = results.filter((c) => c.regime === r);
    const s = sliceStats(cells);
    lines.push('');
    lines.push(`### ${r}`);
    lines.push(`- Cells: ${s.cells}`);
    lines.push(`- Oracle exists: ${fmtRate(s.oracleExistsCount, s.cells)}`);
    lines.push(`- Greedy recall: ${fmtRate(s.greedyRecall.found, s.greedyRecall.of)}`);
    lines.push(`- Face recall: ${fmtRate(s.faceRecall.detected, s.faceRecall.of)}`);
    lines.push(
      `- Face precision: ${fmtRate(s.facePrecision.correct, s.facePrecision.of)}`,
    );
    lines.push(
      `- Face FP/FN: ${s.faceFalsePositives}/${s.faceFalseNegatives}, Greedy misses: ${s.greedyMisses}`,
    );
  }
  lines.push('');

  // Per (regime, profile)
  lines.push('## Greedy recall by (regime, profile)');
  lines.push('');
  lines.push('| regime | short [5,3] | medium [6,4,3] | long [8,6,4] |');
  lines.push('|---|---|---|---|');
  for (const r of regimes) {
    const row = [`| ${r}`];
    for (const p of PROFILES) {
      const cells = results.filter((c) => c.regime === r && c.profile === p.label);
      const s = sliceStats(cells);
      row.push(fmtRate(s.greedyRecall.found, s.greedyRecall.of));
    }
    lines.push(row.join(' | ') + ' |');
  }
  lines.push('');

  // Per board, per profile — detailed table
  lines.push('## Per board, per profile');
  lines.push('');
  lines.push(
    '| board | profile | seeds oracle✓ | greedy✓\\|oracle✓ | face✓\\|oracle✓ | face FP |',
  );
  lines.push('|---|---|---|---|---|---|');
  for (const spec of BOARDS) {
    for (const p of PROFILES) {
      const cells = results.filter((c) => c.board === spec.name && c.profile === p.label);
      const s = sliceStats(cells);
      lines.push(
        `| ${spec.name} | ${p.label} | ${s.oracleExistsCount}/${cells.length} | ${fmtRate(s.greedyRecall.found, s.greedyRecall.of)} | ${fmtRate(s.faceRecall.detected, s.faceRecall.of)} | ${s.faceFalsePositives} |`,
      );
    }
  }
  lines.push('');

  // Disagreement highlights
  lines.push('## Disagreement highlights');
  lines.push('');
  lines.push('### Greedy misses (oracle exists, greedy failed)');
  const greedyMissRows = results.filter((c) => c.oracleExists && !c.greedyFound);
  if (greedyMissRows.length === 0) {
    lines.push('(none)');
  } else {
    for (const c of greedyMissRows) {
      lines.push(
        `- ${c.board} seed=${c.seed} profile=${c.profile} lanes=[${c.lanes.join(',')}]`,
      );
    }
  }
  lines.push('');
  lines.push('### Face projection false positives (face feasible, oracle says no)');
  const faceFPRows = results.filter((c) => c.faceFeasible && !c.oracleExists);
  if (faceFPRows.length === 0) {
    lines.push('(none)');
  } else {
    for (const c of faceFPRows) {
      lines.push(
        `- ${c.board} seed=${c.seed} profile=${c.profile} lanes=[${c.lanes.join(',')}]`,
      );
    }
  }
  lines.push('');
  lines.push('### Face projection false negatives (oracle exists, face says infeasible)');
  const faceFNRows = results.filter((c) => !c.faceFeasible && c.oracleExists);
  if (faceFNRows.length === 0) {
    lines.push('(none)');
  } else {
    for (const c of faceFNRows) {
      lines.push(
        `- ${c.board} seed=${c.seed} profile=${c.profile} lanes=[${c.lanes.join(',')}]`,
      );
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────

const t0 = Date.now();
console.log(
  `running ${BOARDS.length} boards × ${SEEDS.length} seeds × ${PROFILES.length} profiles = ${BOARDS.length * SEEDS.length * PROFILES.length} cells`,
);
const results = runMatrix();
const elapsedMs = Date.now() - t0;
console.log(`done in ${elapsedMs}ms`);

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const now = new Date();
const ts =
  `${now.getMonth() + 1}.${String(now.getDate()).padStart(2, '0')}` +
  `-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

const csvPath = path.join(outputDir, `${ts}-evaluate-heuristics.csv`);
fs.writeFileSync(csvPath, toCsv(results));
console.log(`wrote ${path.relative(process.cwd(), csvPath)}`);

const mdPath = path.join(outputDir, `${ts}-evaluate-heuristics-summary.md`);
fs.writeFileSync(mdPath, markdownSummary(results));
console.log(`wrote ${path.relative(process.cwd(), mdPath)}`);

// Also print the overall summary to stdout for quick inspection.
console.log();
console.log(markdownSummary(results));
