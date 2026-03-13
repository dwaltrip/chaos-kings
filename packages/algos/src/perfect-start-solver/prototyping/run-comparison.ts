import { runComparison } from './comparison';
import type { RunConfig } from './comparison';
import { landOnly } from './scoring-functions';
import { makeBoard } from './test-boards';

// -- Boards ------------------------------------------------------------------

const boards = [makeBoard('open-7x7')];

// -- Scoring functions -------------------------------------------------------

const scoringFns = [{ name: 'land-only', fn: landOnly }];

// -- Build config matrix -----------------------------------------------------

const beamWidths = [50, 100, 200];
const maxTicks = 25;

const configs: RunConfig[] = [];
for (const board of boards) {
  for (const scoringFn of scoringFns) {
    for (const beamWidth of beamWidths) {
      configs.push({ board, scoringFn, beamWidth, maxTicks });
    }
  }
}

// -- Run and output ----------------------------------------------------------

const results = runComparison(configs);

for (const r of results) {
  console.log(
    JSON.stringify({
      board: r.boardName,
      scoring: r.scoringFnName,
      beamWidth: r.beamWidth,
      maxTicks: r.maxTicks,
      finalLand: r.finalLand,
      durationMs: r.durationMs,
      landCurve: r.landCurve,
    }),
  );
}
