import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { Coord } from '@core/types';

import { runComparison } from './comparison';
import type { RunConfig, RunResult } from './comparison';
import { alignColumns, coordStr, formatMove, formatTable, num } from './format';
import {
  landOnly,
  capturableTiles,
  landWeightedCapturable,
  makeFrontierScorer,
} from './scoring-functions';
import { simulate } from './simulation';
import { allBoards } from './test-boards';
import type { ArmySnapshot, Move } from './types';

// -- Boards ------------------------------------------------------------------

const boards = allBoards();

// -- Scoring functions -------------------------------------------------------

// NOTE: `fingerprintState` is a net-negative perf-wise for "land-only"
// because it's scoring fn is so cheap to run. Could make it optional.
// It's a clear win for all the rest.
const allScoringFns = [
  { name: 'land-only', fn: landOnly },
  { name: 'capturable-tiles', fn: capturableTiles },
  { name: 'land-weighted-cap', fn: landWeightedCapturable },
  { name: 'frontier-1.5', fn: makeFrontierScorer(1.5) },
  { name: 'frontier-2', fn: makeFrontierScorer(2) },
  { name: 'frontier-3', fn: makeFrontierScorer(3) },
  { name: 'frontier-5', fn: makeFrontierScorer(5) },
];

const scoreArg = process.argv.find((a) => a.startsWith('--score='));
const scoreFilter = scoreArg ? scoreArg.slice(8).split(',') : null;
const scoringFns = scoreFilter
  ? allScoringFns.filter((s) => scoreFilter.some((f) => s.name.includes(f)))
  : allScoringFns;

// -- Build config matrix -----------------------------------------------------

const beamArg = process.argv.find((a) => a.startsWith('--beam='));
const beamWidths = beamArg ? beamArg.slice(7).split(',').map(Number) : [50, 100, 200];
const maxTicks = 50;

const configs: RunConfig[] = [];
for (const board of boards) {
  for (const scoringFn of scoringFns) {
    for (const beamWidth of beamWidths) {
      configs.push({ board, scoringFn, beamWidth, maxTicks });
    }
  }
}

// -- Run ---------------------------------------------------------------------

const results = runComparison(configs);

// -- Build output ------------------------------------------------------------

function chunkLandCurve(landCurve: number[]): Record<string, number[]> {
  // buckets are 0, 1-10, 11-20, etc. (we could skip 0 but nice to show for consistency)
  const ticks = landCurve.slice(1);
  const chunks: Record<string, number[]> = { tick0: [landCurve[0]] };
  for (let i = 0; i < ticks.length; i += 10) {
    const end = Math.min(i + 10, ticks.length);
    const label = `tick${end}`;
    chunks[label] = ticks.slice(i, end);
  }
  return chunks;
}

function formatArmies(snapshot: ArmySnapshot[]): string {
  if (snapshot.length === 0) return '';
  return snapshot.map((a) => `${a.units}@${coordStr(a.coord)}`).join(' ');
}

function formatTickLog(
  moves: Move[],
  landCurve: number[],
  generalArmyCurve: number[],
  armySnapshots: ArmySnapshot[][],
  generalCoord: Coord,
): string {
  const header = `general: ${coordStr(generalCoord)}\n`;
  const rows = moves.map((move, i) => {
    const tick = i + 1;
    return [
      `Tick ${num(tick, 2)}:`,
      `land=${num(landCurve[tick], 2)}`,
      `gen[${num(generalArmyCurve[tick], 2)}]`,
      `move=${formatMove(move)}`,
      `top: ${formatArmies(armySnapshots[tick])}`,
    ];
  });
  return header + alignColumns(rows).join('\n') + '\n';
}

function buildOutput(result: RunResult, config: RunConfig) {
  const sim = simulate(
    structuredClone(config.board.board),
    result.moves,
    config.maxTicks,
    config.board.generalCoord,
  );

  const { perf } = result;
  const ms = (n: number) => Math.round(n);

  return {
    json: {
      board: result.boardName,
      scoring: result.scoringFnName,
      beamWidth: result.beamWidth,
      maxTicks: result.maxTicks,
      finalLand: result.finalLand,
      durationMs: result.durationMs,
      landCurve: chunkLandCurve(sim.landCurve),
      perf: {
        totalMs: ms(perf.totalMs),
        genMs: ms(perf.genMs),
        cloneStepMs: ms(perf.cloneStepMs),
        dedupMs: ms(perf.dedupMs),
        scoreSortMs: ms(perf.scoreSortMs),
        totalCandidates: perf.totalCandidates,
        totalScoreCalls: perf.totalScoreCalls,
      },
    },
    tickLog: formatTickLog(
      result.moves,
      sim.landCurve,
      sim.generalArmyCurve,
      sim.armySnapshots,
      config.board.generalCoord,
    ),
  };
}

const outputs = results.map((r, i) => buildOutput(r, configs[i]));

// -- Write to files ----------------------------------------------------------

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// JSON results
const jsonPath = path.join(dataDir, `${timestamp}-results.json`);
const jsonRows = outputs.map((o) => o.json);
fs.writeFileSync(jsonPath, JSON.stringify(jsonRows, null, 2) + '\n');
execSync(`fjson -i 2 "${jsonPath}" -o "${jsonPath}"`);

// Tick logs (one section per run)
const logPath = path.join(dataDir, `${timestamp}-ticks.log`);
const logSections = outputs.map((o) => {
  const { json } = o;
  const header = `=== ${json.scoring} | beam=${json.beamWidth} | ${json.board} | land=${json.finalLand} | ${json.durationMs}ms ===`;
  return header + '\n' + o.tickLog;
});
fs.writeFileSync(logPath, logSections.join('\n') + '\n');

// -- Console summary ---------------------------------------------------------

const relJson = path.relative(process.cwd(), jsonPath);
const relLog = path.relative(process.cwd(), logPath);
const tablePath = path.join(dataDir, `${timestamp}-summary.md`);
const relTable = path.relative(process.cwd(), tablePath);
console.log(`Results: ${relJson}`);
console.log(`Logs:    ${relLog}`);
console.log(`Table:   ${relTable}\n`);

// Build a lookup: (board, scoring, beam) -> output
const resultMap = new Map<string, (typeof outputs)[number]>();
for (const o of outputs) {
  resultMap.set(`${o.json.board}|${o.json.scoring}|${o.json.beamWidth}`, o);
}

const beamHeaders = beamWidths.map((b) => `beam=${b}`);
const tableRows: string[][] = [];
for (const board of boards) {
  for (const scoringFn of scoringFns) {
    const cells = beamWidths.map((bw) => {
      const o = resultMap.get(`${board.name}|${scoringFn.name}|${bw}`);
      if (!o) return '–';
      return `${num(o.json.finalLand, 2)} land  ${num(o.json.perf.totalMs, 5)}ms`;
    });
    tableRows.push([board.name, scoringFn.name, ...cells]);
  }
}

const table = formatTable(['Board', 'Scoring', ...beamHeaders], tableRows);
fs.writeFileSync(tablePath, table + '\n');
console.log(table);
