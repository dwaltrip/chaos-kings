/**
 * Post-processing analysis for solver comparison results.
 * Reads results JSON files from data/ and produces compact views.
 *
 * Usage (from packages/algos):
 *   npx tsx src/perfect-start-solver/prototyping/analyze-results.ts [options] [file]
 *
 * Options:
 *   --pivot          Pivot table: boards × scorers, one per beam width (default)
 *   --summary        Per-scorer scorecard: best, worst, avg, regressions
 *   --regressions    Flag cases where higher beam → lower land
 *   --diff <file>    Compare two result files
 *   --beam=200       Filter to specific beam width(s) for pivot/summary
 *
 * If no file given, uses the most recent *-results.json in data/.
 */

import fs from 'node:fs';
import path from 'node:path';

// -- Types -------------------------------------------------------------------

interface ResultRow {
  board: string;
  scoring: string;
  beamWidth: number;
  maxTicks: number;
  finalLand: number;
  durationMs: number;
}

// -- Load data ---------------------------------------------------------------

function findLatestResults(dataDir: string): string {
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith('-results.json'))
    .sort();
  if (files.length === 0) throw new Error('No results files in ' + dataDir);
  return path.join(dataDir, files[files.length - 1]);
}

function loadResults(filePath: string): ResultRow[] {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// -- Helpers -----------------------------------------------------------------

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function groupBy(rows: ResultRow[]): Map<string, ResultRow> {
  const map = new Map<string, ResultRow>();
  for (const r of rows) {
    map.set(`${r.board}|${r.scoring}|${r.beamWidth}`, r);
  }
  return map;
}

function padR(s: string, w: number): string {
  return s.padEnd(w);
}

function padL(s: string, w: number): string {
  return s.padStart(w);
}

// -- Pivot table -------------------------------------------------------------

function printPivot(rows: ResultRow[], beamFilter: number | null): void {
  const beamWidths = unique(rows.map((r) => r.beamWidth)).sort((a, b) => a - b);
  const targets = beamFilter ? [beamFilter] : beamWidths;
  const boards = unique(rows.map((r) => r.board));
  const scorers = unique(rows.map((r) => r.scoring));
  const lookup = groupBy(rows);

  for (const bw of targets) {
    console.log(`\n  PIVOT — beam=${bw}`);

    // Find best land per board at this beam width
    const bestPerBoard = new Map<string, number>();
    for (const board of boards) {
      let best = 0;
      for (const scorer of scorers) {
        const r = lookup.get(`${board}|${scorer}|${bw}`);
        if (r && r.finalLand > best) best = r.finalLand;
      }
      bestPerBoard.set(board, best);
    }

    const boardW = Math.max(5, ...boards.map((b) => b.length));
    const colW = Math.max(4, ...scorers.map((s) => s.length));

    // Header
    const header =
      '  ' + padR('', boardW) + ' | ' + scorers.map((s) => padL(s, colW)).join(' | ');
    const divider =
      '  ' + '-'.repeat(boardW) + '-+-' + scorers.map(() => '-'.repeat(colW)).join('-+-');

    console.log(header);
    console.log(divider);

    for (const board of boards) {
      const best = bestPerBoard.get(board) ?? 0;
      const cells = scorers.map((scorer) => {
        const r = lookup.get(`${board}|${scorer}|${bw}`);
        if (!r) return padL('-', colW);
        const star = r.finalLand === best ? '*' : ' ';
        return padL(`${r.finalLand}${star}`, colW);
      });
      console.log('  ' + padR(board, boardW) + ' | ' + cells.join(' | '));
    }
  }
}

// -- Scorer summary ----------------------------------------------------------

function printSummary(rows: ResultRow[], beamFilter: number | null): void {
  const beamWidths = unique(rows.map((r) => r.beamWidth)).sort((a, b) => a - b);
  const boards = unique(rows.map((r) => r.board));
  const scorers = unique(rows.map((r) => r.scoring));
  const lookup = groupBy(rows);

  const targetBeam = beamFilter ?? beamWidths[beamWidths.length - 1];

  console.log(`\n  SUMMARY — beam=${targetBeam}`);

  // Count regressions: for each scorer+board, check if any lower beam got higher land
  interface ScorerStats {
    name: string;
    lands: number[];
    best: number;
    worst: number;
    avg: number;
    regressions: string[]; // board names where higher beam → lower land
    bestCount: number; // boards where this scorer is best
  }

  const stats: ScorerStats[] = [];

  // Best land per board at target beam (across all scorers)
  const bestPerBoard = new Map<string, number>();
  for (const board of boards) {
    let best = 0;
    for (const scorer of scorers) {
      const r = lookup.get(`${board}|${scorer}|${targetBeam}`);
      if (r && r.finalLand > best) best = r.finalLand;
    }
    bestPerBoard.set(board, best);
  }

  for (const scorer of scorers) {
    const lands: number[] = [];
    const regressions: string[] = [];
    let bestCount = 0;

    for (const board of boards) {
      const r = lookup.get(`${board}|${scorer}|${targetBeam}`);
      if (!r) continue;
      lands.push(r.finalLand);

      if (r.finalLand === bestPerBoard.get(board)) bestCount++;

      // Check for regression: any lower beam width with higher land?
      for (const lowerBw of beamWidths) {
        if (lowerBw >= targetBeam) continue;
        const lower = lookup.get(`${board}|${scorer}|${lowerBw}`);
        if (lower && lower.finalLand > r.finalLand) {
          regressions.push(`${board} (${lower.finalLand}@b${lowerBw}→${r.finalLand})`);
          break; // one regression per board is enough
        }
      }
    }

    if (lands.length === 0) continue;
    stats.push({
      name: scorer,
      lands,
      best: Math.max(...lands),
      worst: Math.min(...lands),
      avg: lands.reduce((a, b) => a + b, 0) / lands.length,
      regressions,
      bestCount,
    });
  }

  // Sort by avg descending, then by regression count ascending
  stats.sort((a, b) => b.avg - a.avg || a.regressions.length - b.regressions.length);

  const nameW = Math.max(6, ...stats.map((s) => s.name.length));
  console.log(
    '  ' + padR('Scorer', nameW) + ' | best | worst |  avg  | #best | regressions',
  );
  console.log('  ' + '-'.repeat(nameW) + '-+------+-------+-------+-------+------------');

  for (const s of stats) {
    const regStr =
      s.regressions.length === 0
        ? 'none'
        : `${s.regressions.length}: ${s.regressions.join(', ')}`;
    console.log(
      '  ' +
        padR(s.name, nameW) +
        ' | ' +
        padL(String(s.best), 4) +
        ' | ' +
        padL(String(s.worst), 5) +
        ' | ' +
        padL(s.avg.toFixed(1), 5) +
        ' | ' +
        padL(String(s.bestCount) + '/' + String(s.lands.length), 5) +
        ' | ' +
        regStr,
    );
  }
}

// -- Regressions -------------------------------------------------------------

function printRegressions(rows: ResultRow[]): void {
  const beamWidths = unique(rows.map((r) => r.beamWidth)).sort((a, b) => a - b);
  const boards = unique(rows.map((r) => r.board));
  const scorers = unique(rows.map((r) => r.scoring));
  const lookup = groupBy(rows);

  console.log('\n  REGRESSIONS (higher beam → lower land)');

  let count = 0;
  for (const board of boards) {
    for (const scorer of scorers) {
      const results = beamWidths
        .map((bw) => ({ bw, r: lookup.get(`${board}|${scorer}|${bw}`) }))
        .filter((x) => x.r !== undefined);

      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        if (curr.r!.finalLand < prev.r!.finalLand) {
          console.log(
            `  ${board} | ${scorer}: ` +
              `${prev.r!.finalLand}@beam=${prev.bw} → ${curr.r!.finalLand}@beam=${curr.bw}`,
          );
          count++;
        }
      }
    }
  }

  if (count === 0) console.log('  None found.');
}

// -- Diff two result files ---------------------------------------------------

function printDiff(
  rows1: ResultRow[],
  rows2: ResultRow[],
  label1: string,
  label2: string,
): void {
  const lookup1 = groupBy(rows1);
  const lookup2 = groupBy(rows2);

  // Find all keys present in either
  const allKeys = new Set([...lookup1.keys(), ...lookup2.keys()]);
  const boards = unique([...rows1, ...rows2].map((r) => r.board));
  const scorers = unique([...rows1, ...rows2].map((r) => r.scoring));
  const beamWidths = unique([...rows1, ...rows2].map((r) => r.beamWidth)).sort(
    (a, b) => a - b,
  );

  console.log(`\n  DIFF: ${label1} vs ${label2}`);

  let improved = 0;
  let regressed = 0;
  let tied = 0;

  for (const bw of beamWidths) {
    const changes: string[] = [];
    for (const board of boards) {
      for (const scorer of scorers) {
        const key = `${board}|${scorer}|${bw}`;
        const r1 = lookup1.get(key);
        const r2 = lookup2.get(key);
        if (!r1 || !r2) continue;
        const delta = r2.finalLand - r1.finalLand;
        if (delta > 0) {
          changes.push(`  +${delta}  ${board} / ${scorer}`);
          improved++;
        } else if (delta < 0) {
          changes.push(`  ${delta}  ${board} / ${scorer}`);
          regressed++;
        } else {
          tied++;
        }
      }
    }

    if (changes.length > 0) {
      console.log(`\n  beam=${bw}:`);
      for (const c of changes) console.log(c);
    }
  }

  console.log(`\n  Total: ${improved} improved, ${regressed} regressed, ${tied} tied`);
}

// -- CLI ---------------------------------------------------------------------

const dataDir = path.join(__dirname, 'data');
const args = process.argv.slice(2);

const hasFlag = (f: string) => args.includes(f);
const getArg = (prefix: string) => {
  const a = args.find((x) => x.startsWith(prefix));
  return a ? a.slice(prefix.length) : null;
};

// Non-flag args are file paths
const fileArgs = args.filter((a) => !a.startsWith('--'));

const beamArg = getArg('--beam=');
const beamFilter = beamArg ? Number(beamArg) : null;

const showPivot = hasFlag('--pivot');
const showSummary = hasFlag('--summary');
const showRegressions = hasFlag('--regressions');
const isDiff = hasFlag('--diff');

// Default: pivot + regressions if no flags given
const noFlags = !showPivot && !showSummary && !showRegressions && !isDiff;

if (isDiff) {
  if (fileArgs.length < 2) {
    console.error('--diff requires two file paths');
    process.exit(1);
  }
  const resolve = (f: string) =>
    path.isAbsolute(f)
      ? f
      : path.resolve(f.startsWith('data/') ? path.join(dataDir, f.slice(5)) : f);
  const file1 = resolve(fileArgs[0]);
  const file2 = resolve(fileArgs[1]);
  const rows1 = loadResults(file1);
  const rows2 = loadResults(file2);
  printDiff(rows1, rows2, path.basename(file1), path.basename(file2));
} else {
  const file = fileArgs[0]
    ? path.isAbsolute(fileArgs[0])
      ? fileArgs[0]
      : path.resolve(fileArgs[0])
    : findLatestResults(dataDir);
  console.log(`File: ${path.relative(process.cwd(), file)}`);
  const rows = loadResults(file);

  if (noFlags || showPivot) printPivot(rows, beamFilter);
  if (noFlags || showRegressions) printRegressions(rows);
  if (showSummary) printSummary(rows, beamFilter);
}

console.log();
