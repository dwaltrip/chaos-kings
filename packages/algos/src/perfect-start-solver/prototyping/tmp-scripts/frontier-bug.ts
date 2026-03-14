// @ts-nocheck
/**
 * frontier-bug.ts — Analysis of the frontier(2) beam width regression on maze-7x7.
 *
 * Bug: beam=50 gets 23 land, beam=200 gets only 21 land.
 * A good scorer should never get worse with more search budget.
 *
 * Run: npx tsx src/perfect-start-solver/prototyping/tmp-scripts/frontier-bug.ts
 * from packages/algos/
 */

import type { BoardState, Coord } from '@core/types';
import { DEFAULT_TIMING } from '@core/game-timing-config';
import type { TimingConfig } from '@core/timing/types';

import { TileType, NO_OWNER, Board, cloneBoard } from '@/core-next/flat-board';
import type { FlatBoard } from '@/core-next/flat-board';
import { processStep } from '@/core-next/process-step';
import type { FlatMove } from '@/core-next/process-step';
import { fromBoardState } from '@/core-next/convert';

import { ALL_DIRECTIONS } from '../helpers';
import { makeFrontierScorer } from '../scoring-functions';
import { makeBoard } from '../test-boards';
import type { ScoringFn } from '../types';

// ============================================================================
// Helpers (replicated from solver.ts to avoid modifying it)
// ============================================================================

interface SolverState {
  board: FlatBoard;
  tick: number;
  moves: FlatMove[];
}

function generateMoves(state: SolverState): FlatMove[] {
  const { board } = state;
  const moves: FlatMove[] = [null];
  const n = board.width * board.height;
  for (let i = 0; i < n; i++) {
    if (board.owners[i] !== 0 || board.units[i] <= 1) continue;
    for (const dir of ALL_DIRECTIONS) {
      const dest = Board.neighbor(board, i, dir);
      if (dest !== -1 && board.types[dest] !== TileType.MOUNTAIN) {
        moves.push({ src: i, dir });
      }
    }
  }
  return moves;
}

function cloneState(state: SolverState): SolverState {
  return {
    board: cloneBoard(state.board),
    tick: state.tick,
    moves: [...state.moves],
  };
}

function stepState(state: SolverState, move: FlatMove, timing: TimingConfig): void {
  state.tick++;
  processStep(state.board, move, 0, state.tick, timing);
  state.moves.push(move);
}

function flatMoveToStr(m: FlatMove, board: FlatBoard): string {
  if (!m) return 'WAIT';
  const { x, y } = Board.toXY(board, m.src);
  return `(${x},${y})->${m.dir}`;
}

function countFrontier(board: FlatBoard): number {
  const n = board.width * board.height;
  const seen = new Uint8Array(n);
  let frontier = 0;
  for (let i = 0; i < n; i++) {
    if (board.owners[i] !== 0) continue;
    for (const dir of ALL_DIRECTIONS) {
      const ni = Board.neighbor(board, i, dir);
      if (ni === -1) continue;
      if (seen[ni]) continue;
      seen[ni] = 1;
      if (board.types[ni] === TileType.BLANK) frontier++;
    }
  }
  return frontier;
}

function boardFingerprint(board: FlatBoard): string {
  const parts: string[] = [];
  const n = board.width * board.height;
  for (let i = 0; i < n; i++) {
    if (board.owners[i] === 0) {
      const { x, y } = Board.toXY(board, i);
      parts.push(`(${x},${y})`);
    }
  }
  return parts.join(',');
}

// ============================================================================
// Instrumented beam search — captures full beam populations per tick
// ============================================================================

interface TickSnapshot {
  tick: number;
  beamStates: {
    score: number;
    land: number;
    frontier: number;
    fingerprint: string;
    lastMove: string;
  }[];
}

function solveInstrumented(
  boardState: BoardState,
  _generalCoord: Coord,
  beamWidth: number,
  maxTicks: number,
  scoringFn: ScoringFn,
): { moves: FlatMove[]; snapshots: TickSnapshot[]; finalLand: number } {
  const timing = DEFAULT_TIMING;
  const board = fromBoardState(structuredClone(boardState), 1);

  const initial: SolverState = { board, tick: 0, moves: [] };
  let beam: SolverState[] = [initial];
  const snapshots: TickSnapshot[] = [];

  // Capture initial snapshot
  snapshots.push({
    tick: 0,
    beamStates: [
      {
        score: scoringFn(initial.board),
        land: initial.board.stats.landCounts[0],
        frontier: countFrontier(initial.board),
        fingerprint: boardFingerprint(initial.board),
        lastMove: 'START',
      },
    ],
  });

  for (let t = 0; t < maxTicks; t++) {
    const expanded: { state: SolverState; move: FlatMove }[] = [];
    for (const state of beam) {
      const moves = generateMoves(state);
      for (const move of moves) {
        expanded.push({ state, move });
      }
    }

    const candidates: SolverState[] = [];
    for (const { state, move } of expanded) {
      const child = cloneState(state);
      stepState(child, move, timing);
      candidates.push(child);
    }

    const scored = candidates.map((c) => ({
      state: c,
      score: scoringFn(c.board),
    }));
    scored.sort((a, b) => b.score - a.score);
    beam = scored.slice(0, beamWidth).map((s) => s.state);

    // Capture snapshot of the beam
    const snap: TickSnapshot = {
      tick: t + 1,
      beamStates: beam.map((s, i) => ({
        score: scored[i].score,
        land: s.board.stats.landCounts[0],
        frontier: countFrontier(s.board),
        fingerprint: boardFingerprint(s.board),
        lastMove: flatMoveToStr(s.moves[s.moves.length - 1], s.board),
      })),
    };
    snapshots.push(snap);
  }

  const best = beam[0];
  return {
    moves: best.moves,
    snapshots,
    finalLand: best.board.stats.landCounts[0],
  };
}

// ============================================================================
// STEP 1: Reproduce
// ============================================================================

console.log('='.repeat(80));
console.log('STEP 1: REPRODUCE');
console.log('='.repeat(80));

const mazeBoard = makeBoard('maze-7x7');
const scorer = makeFrontierScorer(2);

const run50 = solveInstrumented(mazeBoard.board, mazeBoard.generalCoord, 50, 50, scorer);
const run200 = solveInstrumented(
  mazeBoard.board,
  mazeBoard.generalCoord,
  200,
  50,
  scorer,
);

console.log(`beam=50:  finalLand = ${run50.finalLand}`);
console.log(`beam=200: finalLand = ${run200.finalLand}`);
console.log(`Regression confirmed: ${run200.finalLand < run50.finalLand ? 'YES' : 'NO'}`);
console.log();

// ============================================================================
// STEP 2: Compare move sequences — find divergence point
// ============================================================================

console.log('='.repeat(80));
console.log('STEP 2: MOVE SEQUENCE COMPARISON');
console.log('='.repeat(80));

const refBoard = fromBoardState(structuredClone(mazeBoard.board), 1);

let divergeTick = -1;
console.log('Tick | beam=50 move               | beam=200 move              | Match?');
console.log('-----|----------------------------|----------------------------|-------');
for (let t = 0; t < 50; t++) {
  const m50 = run50.moves[t];
  const m200 = run200.moves[t];
  const s50 = flatMoveToStr(m50, refBoard);
  const s200 = flatMoveToStr(m200, refBoard);
  const match = s50 === s200;
  if (!match && divergeTick === -1) divergeTick = t + 1;
  const marker = match ? '  =  ' : ' *** ';
  console.log(
    `  ${String(t + 1).padStart(2)} | ${s50.padEnd(26)} | ${s200.padEnd(26)} |${marker}`,
  );
}
console.log();
console.log(`First divergence at tick: ${divergeTick}`);
console.log();

// ============================================================================
// STEP 3: Score analysis at divergence
// ============================================================================

console.log('='.repeat(80));
console.log('STEP 3: SCORE ANALYSIS AT DIVERGENCE');
console.log('='.repeat(80));

// Compare the top-of-beam states around the divergence point
function printBeamAnalysis(
  snapshots: TickSnapshot[],
  label: string,
  tickStart: number,
  tickEnd: number,
) {
  console.log(`\n--- ${label} beam population (ticks ${tickStart}-${tickEnd}) ---`);
  for (let t = tickStart; t <= tickEnd; t++) {
    const snap = snapshots[t];
    if (!snap) continue;

    // Count unique fingerprints
    const fps = new Set(snap.beamStates.map((s) => s.fingerprint));

    // Score distribution
    const scores = snap.beamStates.map((s) => s.score);
    const lands = snap.beamStates.map((s) => s.land);
    const frontiers = snap.beamStates.map((s) => s.frontier);

    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const minLand = Math.min(...lands);
    const maxLand = Math.max(...lands);
    const minFrontier = Math.min(...frontiers);
    const maxFrontier = Math.max(...frontiers);

    console.log(
      `  Tick ${String(t).padStart(2)}: ` +
        `${snap.beamStates.length} states, ` +
        `${fps.size} unique, ` +
        `score=[${minScore}-${maxScore}], ` +
        `land=[${minLand}-${maxLand}], ` +
        `frontier=[${minFrontier}-${maxFrontier}]`,
    );

    // Show top 5 states
    if (t >= divergeTick - 1 && t <= divergeTick + 3) {
      const top5 = snap.beamStates.slice(0, 5);
      for (let i = 0; i < top5.length; i++) {
        const s = top5[i];
        console.log(
          `    #${i + 1}: score=${s.score} land=${s.land} frontier=${s.frontier} ` +
            `move=${s.lastMove}`,
        );
      }
    }
  }
}

// Show beam analysis around divergence
const windowStart = Math.max(1, divergeTick - 3);
const windowEnd = Math.min(50, divergeTick + 10);
printBeamAnalysis(run50.snapshots, 'beam=50', windowStart, windowEnd);
printBeamAnalysis(run200.snapshots, 'beam=200', windowStart, windowEnd);

// Deeper analysis: at the divergence tick, what does each run's beam look like?
console.log('\n--- Detailed divergence analysis ---');
if (divergeTick > 0) {
  const preDiverge50 = run50.snapshots[divergeTick - 1];
  const preDiverge200 = run200.snapshots[divergeTick - 1];
  const atDiverge50 = run50.snapshots[divergeTick];
  const atDiverge200 = run200.snapshots[divergeTick];

  console.log(`\nPre-divergence (tick ${divergeTick - 1}):`);
  console.log(
    `  beam=50:  top score=${preDiverge50.beamStates[0].score}, top land=${preDiverge50.beamStates[0].land}, top frontier=${preDiverge50.beamStates[0].frontier}`,
  );
  console.log(
    `  beam=200: top score=${preDiverge200.beamStates[0].score}, top land=${preDiverge200.beamStates[0].land}, top frontier=${preDiverge200.beamStates[0].frontier}`,
  );

  console.log(`\nAt divergence (tick ${divergeTick}):`);
  console.log(
    `  beam=50:  top score=${atDiverge50.beamStates[0].score}, top land=${atDiverge50.beamStates[0].land}, top frontier=${atDiverge50.beamStates[0].frontier}`,
  );
  console.log(
    `  beam=200: top score=${atDiverge200.beamStates[0].score}, top land=${atDiverge200.beamStates[0].land}, top frontier=${atDiverge200.beamStates[0].frontier}`,
  );

  // Check if beam=200 is keeping high-frontier-but-low-land states
  console.log(
    `\nBeam=200 states at tick ${divergeTick} — frontier vs land distribution:`,
  );
  const statesAtDiv200 = atDiverge200.beamStates;
  const highFrontierLowLand = statesAtDiv200.filter((s) => s.frontier > s.land);
  console.log(
    `  States where frontier > land: ${highFrontierLowLand.length} / ${statesAtDiv200.length}`,
  );

  // Distribution of land values in the beam
  const landDist: Record<number, number> = {};
  for (const s of statesAtDiv200) {
    landDist[s.land] = (landDist[s.land] || 0) + 1;
  }
  console.log(`  Land distribution: ${JSON.stringify(landDist)}`);

  // Distribution of frontier values
  const frontierDist: Record<number, number> = {};
  for (const s of statesAtDiv200) {
    frontierDist[s.frontier] = (frontierDist[s.frontier] || 0) + 1;
  }
  console.log(`  Frontier distribution: ${JSON.stringify(frontierDist)}`);
}

// Track land and frontier curves for the BEST state at each tick
console.log('\n--- Best-state curves (land, frontier, score) ---');
console.log('Tick | b50_land b50_fr b50_sc | b200_land b200_fr b200_sc');
console.log('-----|------------------------|-------------------------');
for (let t = 0; t <= 50; t++) {
  const s50 = run50.snapshots[t].beamStates[0];
  const s200 = run200.snapshots[t].beamStates[0];
  console.log(
    `  ${String(t).padStart(2)} | ` +
      `${String(s50.land).padStart(4)} ${String(s50.frontier).padStart(6)} ${String(s50.score).padStart(6)} | ` +
      `${String(s200.land).padStart(5)} ${String(s200.frontier).padStart(7)} ${String(s200.score).padStart(7)}`,
  );
}

// ============================================================================
// STEP 4: Write-up
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('STEP 4: FINDINGS SUMMARY');
console.log('='.repeat(80));

console.log(`
DIVERGENCE POINT: Tick ${divergeTick}

WHAT HAPPENS:
- Both runs are identical through tick ${divergeTick - 1}.
- At tick ${divergeTick}, beam=50 chooses: ${flatMoveToStr(run50.moves[divergeTick - 1], refBoard)}
  beam=200 chooses: ${flatMoveToStr(run200.moves[divergeTick - 1], refBoard)}

KEY OBSERVATION:
The beam=200 run stalls out after reaching 21 land (around tick 45) and WAITs
for the final 5 ticks, while beam=50 keeps expanding right up to tick 50.

This suggests the beam=200 path enters a "dead end" — a position with high frontier
(many adjacent blanks) but poor expansion potential because those blanks lead into
mountain-blocked corridors on the maze board.

The wider beam (200) retains many more "high-frontier" states that happen to be
traps — positions where the territory touches many blanks but the actual paths to
capture them are blocked by mountains. The narrower beam (50) is forced to prune
these trap states early, and the surviving states happen to have genuinely better
expansion paths.

HYPOTHESIS:
Frontier count is a misleading heuristic on maze terrain because it doesn't account
for connectivity. A tile touching 5 blanks looks great to the frontier scorer, but if
4 of those blanks are dead ends behind mountains, the actual expansion potential is
much lower. With beam=200, there are enough slots to keep these "high-frontier trap"
states alive, and they crowd out states with lower frontier but better actual paths.
With beam=50, the pruning pressure accidentally eliminates the traps.

This is a classic beam search pathology: a wider beam can perform worse when the
scoring function has systematic biases that get amplified by retaining more states.
`);

// ============================================================================
// EXPERIMENT A: Diversity analysis — how many unique territory shapes at each tick?
// ============================================================================

console.log('='.repeat(80));
console.log('EXPERIMENT A: BEAM DIVERSITY (unique territory fingerprints per tick)');
console.log('='.repeat(80));

console.log('Tick | beam=50 unique/total | beam=200 unique/total');
console.log('-----|---------------------|----------------------');
for (let t = 1; t <= 50; t++) {
  const s50 = run50.snapshots[t];
  const s200 = run200.snapshots[t];
  const u50 = new Set(s50.beamStates.map((s) => s.fingerprint)).size;
  const u200 = new Set(s200.beamStates.map((s) => s.fingerprint)).size;
  const pct50 = Math.round((u50 / s50.beamStates.length) * 100);
  const pct200 = Math.round((u200 / s200.beamStates.length) * 100);
  console.log(
    `  ${String(t).padStart(2)} | ` +
      `${String(u50).padStart(4)}/${String(s50.beamStates.length).padStart(4)} (${String(pct50).padStart(3)}%) | ` +
      `${String(u200).padStart(4)}/${String(s200.beamStates.length).padStart(4)} (${String(pct200).padStart(3)}%)`,
  );
}

// ============================================================================
// EXPERIMENT B: Does corridor-7x7 also regress?
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT B: CORRIDOR BOARD REGRESSION CHECK');
console.log('='.repeat(80));

const corridorBoard = makeBoard('corridor-7x7');
const cRun50 = solveInstrumented(
  corridorBoard.board,
  corridorBoard.generalCoord,
  50,
  50,
  scorer,
);
const cRun200 = solveInstrumented(
  corridorBoard.board,
  corridorBoard.generalCoord,
  200,
  50,
  scorer,
);

console.log(`corridor-7x7 beam=50:  finalLand = ${cRun50.finalLand}`);
console.log(`corridor-7x7 beam=200: finalLand = ${cRun200.finalLand}`);
console.log(`Regression: ${cRun200.finalLand < cRun50.finalLand ? 'YES' : 'NO'}`);

// Also check open and sparse
const openBoard = makeBoard('open-7x7');
const oRun50 = solveInstrumented(openBoard.board, openBoard.generalCoord, 50, 50, scorer);
const oRun200 = solveInstrumented(
  openBoard.board,
  openBoard.generalCoord,
  200,
  50,
  scorer,
);
console.log(`open-7x7 beam=50:  finalLand = ${oRun50.finalLand}`);
console.log(`open-7x7 beam=200: finalLand = ${oRun200.finalLand}`);
console.log(`Regression: ${oRun200.finalLand < oRun50.finalLand ? 'YES' : 'NO'}`);

const sparseBoard = makeBoard('sparse-mtns-7x7');
const sRun50 = solveInstrumented(
  sparseBoard.board,
  sparseBoard.generalCoord,
  50,
  50,
  scorer,
);
const sRun200 = solveInstrumented(
  sparseBoard.board,
  sparseBoard.generalCoord,
  200,
  50,
  scorer,
);
console.log(`sparse-mtns-7x7 beam=50:  finalLand = ${sRun50.finalLand}`);
console.log(`sparse-mtns-7x7 beam=200: finalLand = ${sRun200.finalLand}`);
console.log(`Regression: ${sRun200.finalLand < sRun50.finalLand ? 'YES' : 'NO'}`);

// ============================================================================
// EXPERIMENT C: Frontier along good vs bad path — does frontier mislead?
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT C: FRONTIER vs LAND — GOOD PATH vs BAD PATH');
console.log('='.repeat(80));

// Replay both move sequences and compute frontier at each tick
function replayWithFrontier(
  boardState: BoardState,
  moves: FlatMove[],
  maxTicks: number,
): { land: number; frontier: number; score: number }[] {
  const timing = DEFAULT_TIMING;
  const board = fromBoardState(structuredClone(boardState), 1);
  const result: { land: number; frontier: number; score: number }[] = [];

  const land = board.stats.landCounts[0];
  const frontier = countFrontier(board);
  result.push({ land, frontier, score: land * 2 + frontier });

  for (let t = 0; t < maxTicks; t++) {
    const move = t < moves.length ? moves[t] : null;
    processStep(board, move, 0, t + 1, timing);
    const l = board.stats.landCounts[0];
    const f = countFrontier(board);
    result.push({ land: l, frontier: f, score: l * 2 + f });
  }
  return result;
}

const goodPath = replayWithFrontier(mazeBoard.board, run50.moves, 50);
const badPath = replayWithFrontier(mazeBoard.board, run200.moves, 50);

console.log(
  'Tick | GOOD(b50) land  fr  score | BAD(b200) land  fr  score | land_diff  fr_diff',
);
console.log(
  '-----|--------------------------|--------------------------|-------------------',
);
for (let t = 0; t <= 50; t++) {
  const g = goodPath[t];
  const b = badPath[t];
  const landDiff = g.land - b.land;
  const frDiff = g.frontier - b.frontier;
  console.log(
    `  ${String(t).padStart(2)} | ` +
      `${String(g.land).padStart(15)} ${String(g.frontier).padStart(3)} ${String(g.score).padStart(6)} | ` +
      `${String(b.land).padStart(14)} ${String(b.frontier).padStart(3)} ${String(b.score).padStart(6)} | ` +
      `${String(landDiff).padStart(6)}  ${String(frDiff).padStart(6)}`,
  );
}

console.log(
  '\nKey question: Does the bad path ever have HIGHER frontier than the good path?',
);
let badHigherFrontierTicks = 0;
let badHigherScoreTicks = 0;
for (let t = divergeTick; t <= 50; t++) {
  if (badPath[t].frontier > goodPath[t].frontier) badHigherFrontierTicks++;
  if (badPath[t].score > goodPath[t].score) badHigherScoreTicks++;
}
console.log(
  `  Ticks where bad path has higher frontier (after divergence): ${badHigherFrontierTicks}`,
);
console.log(
  `  Ticks where bad path has higher overall score (after divergence): ${badHigherScoreTicks}`,
);

// ============================================================================
// EXPERIMENT D: Check beam=100 to see if regression is gradual
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT D: BEAM WIDTH SWEEP (10, 25, 50, 100, 150, 200, 500)');
console.log('='.repeat(80));

for (const bw of [10, 25, 50, 100, 150, 200, 500]) {
  const r = solveInstrumented(mazeBoard.board, mazeBoard.generalCoord, bw, 50, scorer);
  console.log(`  beam=${String(bw).padStart(3)}: land=${r.finalLand}`);
}

console.log('\n' + '='.repeat(80));
console.log('END OF ANALYSIS');
console.log('='.repeat(80));
