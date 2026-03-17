import fs from 'fs';
import path from 'path';

import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import { Board } from '@/core-next/flat-board';
import type { FlatMove } from '@/core-next/process-step';

import { makeBoard } from '../test-boards';
import { formatTable } from '../format';

import { runSA } from './sim-anneal';

// --- Types ---

interface RunSAOptions {
  board: string;
  ticks: string;
  iterations: string;
  t0: string;
  epsilon: string;
  seeds: string;
}

interface ConfigCombo {
  boardName: string;
  iterations: number;
  t0: number;
  epsilon: number;
}

interface RunRecord {
  boardName: string;
  config: { iterations: number; t0: number; epsilon: number };
  seedIndex: number;
  bestScore: number;
  acceptedCount: number;
  runtimeMs: number;
  scoreProgression: number[];
  bestMoves: (FlatMove | null)[];
}

// --- CLI ---

const { opts } = parseTypedCommand(
  createTypedCommand<RunSAOptions>()
    .name('run-sa')
    .description('Run simulated annealing (multi-config sweep)')
    .option('--board <names>', 'Board names, comma-separated', 'open-7x7')
    .option('--ticks <n>', 'Number of ticks', '50')
    .option('--iterations <counts>', 'Iteration counts, comma-separated', '100000')
    .option('--t0 <values>', 'Initial temperatures, comma-separated', '3.0')
    .option('--epsilon <values>', 'Final temp ratios, comma-separated', '0.001')
    .option('--seeds <n>', 'Runs per config combo', '3'),
);

const totalTicks = Number(opts.ticks);
const seeds = Number(opts.seeds);
const boardNames = opts.board.split(',');
const iterationsList = opts.iterations.split(',').map(Number);
const t0List = opts.t0.split(',').map(Number);
const epsilonList = opts.epsilon.split(',').map(Number);

// --- Helpers ---

function formatFlatMove(move: FlatMove, boardWidth: number): string {
  if (!move) return 'WAIT';
  const { x, y } = Board.toXY({ width: boardWidth } as any, move.src);
  return `(${x},${y})→${move.dir}`;
}

function buildConfigMatrix(): ConfigCombo[] {
  const combos: ConfigCombo[] = [];
  for (const boardName of boardNames) {
    for (const iterations of iterationsList) {
      for (const t0 of t0List) {
        for (const epsilon of epsilonList) {
          combos.push({ boardName, iterations, t0, epsilon });
        }
      }
    }
  }
  return combos;
}

function comboKey(c: ConfigCombo): string {
  return `${c.boardName}|${c.iterations}|${c.t0}|${c.epsilon}`;
}

function buildSummaryTable(records: RunRecord[], combos: ConfigCombo[]): string {
  const grouped = new Map<string, RunRecord[]>();
  for (const r of records) {
    const key = `${r.boardName}|${r.config.iterations}|${r.config.t0}|${r.config.epsilon}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  const headers = [
    'Board',
    'Iters',
    'T0',
    'Eps',
    'Best',
    'Avg',
    'Worst',
    'Avg Time',
    'Accept%',
  ];
  const rows: string[][] = [];

  for (const combo of combos) {
    const key = comboKey(combo);
    const group = grouped.get(key);
    if (!group) continue;

    const scores = group.map((r) => r.bestScore);
    const best = Math.max(...scores);
    const worst = Math.min(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgTime = group.reduce((a, r) => a + r.runtimeMs, 0) / group.length;
    const avgAccept =
      group.reduce((a, r) => a + r.acceptedCount / r.config.iterations, 0) / group.length;

    rows.push([
      combo.boardName,
      combo.iterations.toLocaleString(),
      String(combo.t0),
      String(combo.epsilon),
      String(best),
      avg.toFixed(1),
      String(worst),
      `${(avgTime / 1000).toFixed(2)}s`,
      `${(avgAccept * 100).toFixed(1)}%`,
    ]);
  }

  return formatTable(headers, rows);
}

function writeOutputFiles(records: RunRecord[], summaryTable: string): string[] {
  const dataDir = path.join(__dirname, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonPath = path.join(dataDir, `${timestamp}-results.json`);
  const summaryPath = path.join(dataDir, `${timestamp}-summary.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2));
  fs.writeFileSync(summaryPath, summaryTable);

  return [
    path.relative(process.cwd(), jsonPath),
    path.relative(process.cwd(), summaryPath),
  ];
}

// --- Main ---

function run() {
  const combos = buildConfigMatrix();
  const totalRuns = combos.length * seeds;

  console.log(`${combos.length} config(s) × ${seeds} seed(s) = ${totalRuns} total runs`);
  console.log();

  const records: RunRecord[] = [];
  let overallBest: RunRecord | null = null;
  let overallBestBoardWidth = 7;
  let runIndex = 0;

  for (const combo of combos) {
    const { board } = makeBoard(combo.boardName);

    for (let seed = 0; seed < seeds; seed++) {
      runIndex++;
      const result = runSA(board, totalTicks, {
        iterations: combo.iterations,
        t0: combo.t0,
        epsilon: combo.epsilon,
      });

      const record: RunRecord = {
        boardName: combo.boardName,
        config: { iterations: combo.iterations, t0: combo.t0, epsilon: combo.epsilon },
        seedIndex: seed,
        bestScore: result.bestScore,
        acceptedCount: result.acceptedCount,
        runtimeMs: result.runtimeMs,
        scoreProgression: result.scoreProgression,
        bestMoves: result.bestMoves,
      };
      records.push(record);

      if (!overallBest || record.bestScore > overallBest.bestScore) {
        overallBest = record;
        overallBestBoardWidth = board.size.width;
      }

      const pct = ((result.acceptedCount / combo.iterations) * 100).toFixed(1);
      console.log(
        `  [${runIndex}/${totalRuns}] ${combo.boardName} ` +
          `iters=${combo.iterations.toLocaleString()} t0=${combo.t0} eps=${combo.epsilon} ` +
          `seed=${seed} → score=${result.bestScore} (${(result.runtimeMs / 1000).toFixed(2)}s, ${pct}% accept)`,
      );
    }
  }

  // Summary table
  const summaryTable = buildSummaryTable(records, combos);

  // Write files
  console.log();
  const [jsonPath, summaryPath] = writeOutputFiles(records, summaryTable);
  console.log(`Results: ${jsonPath}`);
  console.log(`Summary: ${summaryPath}`);

  // Print summary
  console.log();
  console.log(summaryTable);

  // Best move sequence
  if (overallBest) {
    console.log();
    console.log(
      `Best overall: score=${overallBest.bestScore} ` +
        `(${overallBest.boardName}, iters=${overallBest.config.iterations.toLocaleString()}, ` +
        `t0=${overallBest.config.t0}, eps=${overallBest.config.epsilon}, seed=${overallBest.seedIndex})`,
    );
    console.log();
    for (let i = 0; i < overallBest.bestMoves.length; i++) {
      const move = overallBest.bestMoves[i];
      console.log(
        `  tick ${String(i + 1).padStart(2)}: ${formatFlatMove(move, overallBestBoardWidth)}`,
      );
    }
  }
}

run();
