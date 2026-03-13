import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { Coord } from '@core/types';

import { runComparison } from './comparison';
import type { RunConfig, RunResult } from './comparison';
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
  // Skip tick 0 (always 1), then bucket into groups of 10
  const ticks = landCurve.slice(1);
  const chunks: Record<string, number[]> = {};
  for (let i = 0; i < ticks.length; i += 10) {
    const end = Math.min(i + 10, ticks.length);
    const label = `tick${end}`;
    chunks[label] = ticks.slice(i, end);
  }
  return chunks;
}

function formatMove(move: Move): string {
  if (move === null) return 'WAIT';
  const { x, y } = move.sourceCoord;
  return `(${x},${y})→${move.direction}`;
}

function formatTickLog(
  moves: Move[],
  landCurve: number[],
  generalArmyCurve: number[],
  generalCoord: Coord,
): string {
  const lines: string[] = [`general: (${generalCoord.x},${generalCoord.y})\n`];

  for (let i = 0; i < moves.length; i++) {
    const tick = i + 1;
    const land = landCurve[tick];
    const genArmy = generalArmyCurve[tick];
    const move = formatMove(moves[i]);
    lines.push(
      `Tick ${String(tick).padStart(2)}: land=${String(land).padStart(2)}` +
        `  gen[${String(genArmy).padStart(2)}]` +
        `  move=${move}`,
    );
  }

  return lines.join('\n') + '\n';
}

function buildOutput(result: RunResult, config: RunConfig) {
  const sim = simulate(
    structuredClone(config.board.board),
    result.moves,
    config.maxTicks,
    config.board.generalCoord,
  );

  return {
    json: {
      board: result.boardName,
      scoring: result.scoringFnName,
      beamWidth: result.beamWidth,
      maxTicks: result.maxTicks,
      finalLand: result.finalLand,
      durationMs: result.durationMs,
      landCurve: chunkLandCurve(sim.landCurve),
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

const dataDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'data');
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

for (const { json } of outputs) {
  console.log(
    `${json.scoring.padEnd(20)} beam=${String(json.beamWidth).padStart(3)}  ` +
      `land=${String(json.finalLand).padStart(2)}  ${json.durationMs}ms`,
  );
}
