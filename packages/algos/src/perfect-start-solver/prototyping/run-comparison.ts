import fs from 'node:fs';
import path from 'node:path';

import { runComparison } from './comparison';
import type { RunConfig, RunResult } from './comparison';
import { landOnly, capturableTiles } from './scoring-functions';
import { simulate } from './simulation';
import { makeBoard } from './test-boards';

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

// -- Build output with actual land curves (via simulation replay) ------------

function buildOutput(result: RunResult, config: RunConfig) {
  const sim = simulate(
    structuredClone(config.board.board),
    result.moves,
    config.maxTicks,
  );

  return {
    board: result.boardName,
    scoring: result.scoringFnName,
    beamWidth: result.beamWidth,
    maxTicks: result.maxTicks,
    finalLand: result.finalLand,
    durationMs: result.durationMs,
    landCurve: sim.landCurve,
  };
}

const outputRows = results.map((r, i) => buildOutput(r, configs[i]));

// -- Write to file -----------------------------------------------------------

const dataDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outPath = path.join(dataDir, `comparison-${timestamp}.json`);
fs.writeFileSync(outPath, JSON.stringify(outputRows, null, 2) + '\n');

// -- Console summary ---------------------------------------------------------

console.log(`Results written to: ${path.relative(process.cwd(), outPath)}\n`);

for (const row of outputRows) {
  console.log(
    `${row.scoring.padEnd(20)} beam=${String(row.beamWidth).padStart(3)}  ` +
      `land=${String(row.finalLand).padStart(2)}  ${row.durationMs}ms`,
  );
}
