import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { Coord } from '@core/types';

import { runComparison } from './comparison';
import type { RunConfig, RunResult } from './comparison';
import { alignColumns, formatMove, num } from './format';
import { landOnly, capturableTiles } from './scoring-functions';
import { simulate } from './simulation';
import { makeBoard } from './test-boards';
import type { Move } from './types';

// -- Boards ------------------------------------------------------------------

const boards = [makeBoard('open-7x7')];

// -- Scoring functions -------------------------------------------------------

const scoringFns = [
  { name: 'land-only', fn: landOnly },
  { name: 'capturable-tiles', fn: capturableTiles },
];

// -- Build config matrix -----------------------------------------------------

const beamWidths = [50, 100, 200];
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

function formatTickLog(
  moves: Move[],
  landCurve: number[],
  generalArmyCurve: number[],
  generalCoord: Coord,
): string {
  const header = `general: (${generalCoord.x},${generalCoord.y})\n`;
  const rows = moves.map((move, i) => {
    const tick = i + 1;
    return [
      `Tick ${num(tick, 2)}:`,
      `land=${num(landCurve[tick], 2)}`,
      `gen[${num(generalArmyCurve[tick], 2)}]`,
      `move=${formatMove(move)}`,
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
        scoreSortMs: ms(perf.scoreSortMs),
        totalCandidates: perf.totalCandidates,
        totalScoreCalls: perf.totalScoreCalls,
      },
    },
    tickLog: formatTickLog(
      result.moves,
      sim.landCurve,
      sim.generalArmyCurve,
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
const jsonPath = path.join(dataDir, `comparison-${timestamp}.json`);
const jsonRows = outputs.map((o) => o.json);
fs.writeFileSync(jsonPath, JSON.stringify(jsonRows, null, 2) + '\n');
execSync(`fjson -i 2 "${jsonPath}" -o "${jsonPath}"`);

// Tick logs (one section per run)
const logPath = path.join(dataDir, `comparison-${timestamp}.log`);
const logSections = outputs.map((o) => {
  const { json } = o;
  const header = `=== ${json.scoring} | beam=${json.beamWidth} | ${json.board} | land=${json.finalLand} | ${json.durationMs}ms ===`;
  return header + '\n' + o.tickLog;
});
fs.writeFileSync(logPath, logSections.join('\n') + '\n');

// -- Console summary ---------------------------------------------------------

const relJson = path.relative(process.cwd(), jsonPath);
const relLog = path.relative(process.cwd(), logPath);
console.log(`Results: ${relJson}`);
console.log(`Logs:    ${relLog}\n`);

const summaryRows = outputs.map(({ json }) => {
  const p = json.perf;
  return [
    json.scoring,
    `beam=${num(json.beamWidth, 3)}`,
    `land=${num(json.finalLand, 2)}`,
    `${num(p.totalMs, 5)}ms`,
    `[gen ${num(p.genMs, 4)}`,
    `clone+step ${num(p.cloneStepMs, 4)}`,
    `score+sort ${num(p.scoreSortMs, 4)}]`,
    `${p.totalCandidates} cands`,
    `${p.totalScoreCalls} scores`,
  ];
});
console.log(alignColumns(summaryRows).join('\n'));
