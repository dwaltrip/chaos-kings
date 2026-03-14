// @ts-nocheck
/**
 * sparse-corridor-regression.ts — Analysis of beam width regressions on
 * sparse-mtns-7x7 and corridor-7x7 boards after adding beam deduplication.
 *
 * Regressions under investigation:
 *   sparse-mtns-7x7: ALL three scorers regress (24->23) at beam=200
 *   corridor-7x7:    land-only regresses (23->22) at beam=200
 *
 * Run: npx tsx src/perfect-start-solver/prototyping/tmp-scripts/sparse-corridor-regression.ts
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

import { ALL_DIRECTIONS } from '../../helpers';
import {
  landOnly,
  landWeightedCapturable,
  makeFrontierScorer,
} from '../scoring-functions';
import { makeBoard } from '../../test-boards';
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

// Territory fingerprint: which tiles are owned (ignoring army counts)
function territoryFingerprint(board: FlatBoard): string {
  const parts: string[] = [];
  const n = board.width * board.height;
  for (let i = 0; i < n; i++) {
    if (board.owners[i] === 0) {
      parts.push(`${i}`);
    }
  }
  return parts.join(',');
}

// Full state fingerprint (matching solver.ts fingerprintState)
function stateFingerprint(state: SolverState): string {
  const { board } = state;
  const n = board.width * board.height;
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (board.owners[i] !== NO_OWNER) {
      buf[i] = Math.min(board.units[i], 15);
    }
  }
  return String.fromCharCode(...buf);
}

// ============================================================================
// Instrumented beam search -- captures full beam populations per tick
// Supports optional dedup (matching solver.ts behavior)
// ============================================================================

interface TickSnapshot {
  tick: number;
  totalCandidates: number;
  afterDedup: number;
  beamStates: {
    score: number;
    land: number;
    frontier: number;
    territoryFP: string;
    lastMove: string;
  }[];
}

function solveInstrumented(
  boardState: BoardState,
  _generalCoord: Coord,
  beamWidth: number,
  maxTicks: number,
  scoringFn: ScoringFn,
  useDedup: boolean = true,
): { moves: FlatMove[]; snapshots: TickSnapshot[]; finalLand: number; board: FlatBoard } {
  const timing = DEFAULT_TIMING;
  const board = fromBoardState(structuredClone(boardState), 1);

  const initial: SolverState = { board, tick: 0, moves: [] };
  let beam: SolverState[] = [initial];
  const snapshots: TickSnapshot[] = [];

  // Capture initial snapshot
  snapshots.push({
    tick: 0,
    totalCandidates: 1,
    afterDedup: 1,
    beamStates: [
      {
        score: scoringFn(initial.board),
        land: initial.board.stats.landCounts[0],
        frontier: countFrontier(initial.board),
        territoryFP: territoryFingerprint(initial.board),
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

    const totalCandidates = candidates.length;

    // Optional dedup (matching solver.ts logic exactly)
    let dedupedCandidates = candidates;
    if (useDedup) {
      const seen = new Set<string>();
      const unique: SolverState[] = [];
      for (const c of candidates) {
        const fp = stateFingerprint(c);
        if (!seen.has(fp)) {
          seen.add(fp);
          unique.push(c);
        }
      }
      dedupedCandidates = unique;
    }

    const scored = dedupedCandidates.map((c) => ({
      state: c,
      score: scoringFn(c.board),
    }));
    scored.sort((a, b) => b.score - a.score);
    beam = scored.slice(0, beamWidth).map((s) => s.state);

    // Capture snapshot of the beam
    const snap: TickSnapshot = {
      tick: t + 1,
      totalCandidates,
      afterDedup: dedupedCandidates.length,
      beamStates: beam.map((s, i) => ({
        score: scored[i].score,
        land: s.board.stats.landCounts[0],
        frontier: countFrontier(s.board),
        territoryFP: territoryFingerprint(s.board),
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
    board: best.board,
  };
}

// ============================================================================
// Analysis helpers
// ============================================================================

interface RegressionCase {
  boardName: string;
  scorerName: string;
  scorerFn: ScoringFn;
}

const CASES: RegressionCase[] = [
  { boardName: 'sparse-mtns-7x7', scorerName: 'land-only', scorerFn: landOnly },
  {
    boardName: 'sparse-mtns-7x7',
    scorerName: 'land-weighted-cap',
    scorerFn: landWeightedCapturable,
  },
  {
    boardName: 'sparse-mtns-7x7',
    scorerName: 'frontier(2)',
    scorerFn: makeFrontierScorer(2),
  },
  { boardName: 'corridor-7x7', scorerName: 'land-only', scorerFn: landOnly },
];

function printMoveComparison(
  label1: string,
  label2: string,
  moves1: FlatMove[],
  moves2: FlatMove[],
  board: FlatBoard,
  maxTicks: number,
): number {
  let divergeTick = -1;
  console.log(`Tick | ${label1.padEnd(20)} | ${label2.padEnd(20)} | Match?`);
  console.log('-----|' + '-'.repeat(22) + '|' + '-'.repeat(22) + '|------');
  for (let t = 0; t < maxTicks; t++) {
    const m1 = moves1[t];
    const m2 = moves2[t];
    const s1 = flatMoveToStr(m1, board);
    const s2 = flatMoveToStr(m2, board);
    const match = s1 === s2;
    if (!match && divergeTick === -1) divergeTick = t + 1;
    const marker = match ? '  =  ' : ' *** ';
    console.log(
      `  ${String(t + 1).padStart(2)} | ${s1.padEnd(20)} | ${s2.padEnd(20)} |${marker}`,
    );
  }
  return divergeTick;
}

// ============================================================================
// STEP 1: REPRODUCE
// ============================================================================

console.log('='.repeat(80));
console.log('STEP 1: REPRODUCE REGRESSIONS');
console.log('='.repeat(80));

const MAX_TICKS = 50;

for (const c of CASES) {
  const board = makeBoard(c.boardName);
  const results: { bw: number; land: number }[] = [];
  for (const bw of [50, 100, 200, 500]) {
    const r = solveInstrumented(
      board.board,
      board.generalCoord,
      bw,
      MAX_TICKS,
      c.scorerFn,
    );
    results.push({ bw, land: r.finalLand });
  }
  const line = results.map((r) => `beam=${r.bw}: ${r.land}`).join('  |  ');
  const regressed = results[0].land > results[2].land;
  console.log(
    `${c.boardName} / ${c.scorerName}:  ${line}  ${regressed ? '<<< REGRESSION' : ''}`,
  );
}
console.log();

// ============================================================================
// STEP 2: COMPARE MOVE SEQUENCES - FIND DIVERGENCE POINTS
// ============================================================================

console.log('='.repeat(80));
console.log('STEP 2: MOVE SEQUENCE COMPARISON');
console.log('='.repeat(80));

// Collect detailed runs for each case
interface DetailedRun {
  caseName: string;
  run50: ReturnType<typeof solveInstrumented>;
  run200: ReturnType<typeof solveInstrumented>;
  divergeTick: number;
}

const detailedRuns: DetailedRun[] = [];

for (const c of CASES) {
  const board = makeBoard(c.boardName);
  console.log(`\n--- ${c.boardName} / ${c.scorerName} ---`);

  const run50 = solveInstrumented(
    board.board,
    board.generalCoord,
    50,
    MAX_TICKS,
    c.scorerFn,
  );
  const run200 = solveInstrumented(
    board.board,
    board.generalCoord,
    200,
    MAX_TICKS,
    c.scorerFn,
  );

  const refBoard = fromBoardState(structuredClone(board.board), 1);
  const divergeTick = printMoveComparison(
    `beam=50 (${run50.finalLand})`,
    `beam=200 (${run200.finalLand})`,
    run50.moves,
    run200.moves,
    refBoard,
    MAX_TICKS,
  );

  console.log(`First divergence at tick: ${divergeTick}`);
  console.log(`beam=50: ${run50.finalLand} land  |  beam=200: ${run200.finalLand} land`);

  detailedRuns.push({
    caseName: `${c.boardName}/${c.scorerName}`,
    run50,
    run200,
    divergeTick,
  });
}

// ============================================================================
// STEP 3: SCORE ANALYSIS AT DIVERGENCE
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('STEP 3: SCORE ANALYSIS AT DIVERGENCE');
console.log('='.repeat(80));

for (const dr of detailedRuns) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`CASE: ${dr.caseName}`);
  console.log(`Divergence tick: ${dr.divergeTick}`);
  console.log(
    `beam=50: ${dr.run50.finalLand} land  |  beam=200: ${dr.run200.finalLand} land`,
  );
  console.log('='.repeat(70));

  if (dr.divergeTick < 0) {
    console.log('  No divergence found (identical paths)');
    continue;
  }

  const windowStart = Math.max(1, dr.divergeTick - 3);
  const windowEnd = Math.min(MAX_TICKS, dr.divergeTick + 10);

  // Print beam analysis for both around divergence
  for (const [label, snapshots] of [
    ['beam=50', dr.run50.snapshots],
    ['beam=200', dr.run200.snapshots],
  ] as const) {
    console.log(`\n  --- ${label} beam population ---`);
    for (let t = windowStart; t <= windowEnd; t++) {
      const snap = snapshots[t];
      if (!snap) continue;

      const fps = new Set(snap.beamStates.map((s) => s.territoryFP));
      const scores = snap.beamStates.map((s) => s.score);
      const lands = snap.beamStates.map((s) => s.land);

      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const minLand = Math.min(...lands);
      const maxLand = Math.max(...lands);

      // Score gap: difference between best and worst in beam
      const scoreGap = maxScore - minScore;

      console.log(
        `  Tick ${String(t).padStart(2)}: ` +
          `${snap.beamStates.length} states, ` +
          `${fps.size} unique territories, ` +
          `score=[${minScore}-${maxScore}] gap=${scoreGap}, ` +
          `land=[${minLand}-${maxLand}], ` +
          `cands=${snap.totalCandidates}, dedup=${snap.afterDedup}`,
      );

      // Show top 5 at and around divergence
      if (t >= dr.divergeTick - 1 && t <= dr.divergeTick + 2) {
        const topN = Math.min(5, snap.beamStates.length);
        for (let i = 0; i < topN; i++) {
          const s = snap.beamStates[i];
          console.log(
            `    #${i + 1}: score=${s.score} land=${s.land} frontier=${s.frontier} ` +
              `move=${s.lastMove}`,
          );
        }
      }
    }
  }

  // How many unique territory shapes does each beam have at divergence?
  console.log(`\n  --- Territory diversity at divergence (tick ${dr.divergeTick}) ---`);
  const snap50 = dr.run50.snapshots[dr.divergeTick];
  const snap200 = dr.run200.snapshots[dr.divergeTick];
  if (snap50 && snap200) {
    const fps50 = new Set(snap50.beamStates.map((s) => s.territoryFP));
    const fps200 = new Set(snap200.beamStates.map((s) => s.territoryFP));

    console.log(
      `  beam=50:  ${fps50.size} unique territories out of ${snap50.beamStates.length} states`,
    );
    console.log(
      `  beam=200: ${fps200.size} unique territories out of ${snap200.beamStates.length} states`,
    );

    // Check overlap: does beam=200 contain the territory that beam=50's best has?
    const best50Territory = snap50.beamStates[0].territoryFP;
    const beam200HasBest50 = snap200.beamStates.some(
      (s) => s.territoryFP === best50Territory,
    );
    console.log(
      `  beam=200 contains beam=50's best territory? ${beam200HasBest50 ? 'YES' : 'NO'}`,
    );

    // If yes, what rank is it?
    if (beam200HasBest50) {
      const rank200 = snap200.beamStates.findIndex(
        (s) => s.territoryFP === best50Territory,
      );
      console.log(`    -> at rank ${rank200 + 1} in beam=200`);
      console.log(
        `    -> score in beam=200: ${snap200.beamStates[rank200].score} vs beam=50 top: ${snap50.beamStates[0].score}`,
      );
    }

    // Does beam=200's top score beat beam=50's top score?
    console.log(
      `  Top scores: beam=50=${snap50.beamStates[0].score} vs beam=200=${snap200.beamStates[0].score}`,
    );
  }

  // Land curve comparison: track the best state's land at each tick
  console.log(`\n  --- Best-state land curve ---`);
  console.log('  Tick | b50_land b50_score | b200_land b200_score');
  console.log('  -----|-------------------|--------------------');
  for (let t = 0; t <= MAX_TICKS; t++) {
    const s50 = dr.run50.snapshots[t]?.beamStates[0];
    const s200 = dr.run200.snapshots[t]?.beamStates[0];
    if (!s50 || !s200) continue;

    const marker = t === dr.divergeTick ? ' <-- DIV' : '';
    console.log(
      `    ${String(t).padStart(2)} | ` +
        `${String(s50.land).padStart(4)} ${String(s50.score).padStart(8)} | ` +
        `${String(s200.land).padStart(5)} ${String(s200.score).padStart(9)}${marker}`,
    );
  }

  // Check: is beam=200 top score >= beam=50 at ALL ticks?
  let b200ScoreBetterCount = 0;
  const b200ScoreWorseTicks: number[] = [];
  for (let t = dr.divergeTick; t <= MAX_TICKS; t++) {
    const s50 = dr.run50.snapshots[t]?.beamStates[0];
    const s200 = dr.run200.snapshots[t]?.beamStates[0];
    if (!s50 || !s200) continue;
    if (s200.score >= s50.score) {
      b200ScoreBetterCount++;
    } else {
      b200ScoreWorseTicks.push(t);
    }
  }
  console.log(
    `\n  After divergence: beam=200 has higher/equal top score at ${b200ScoreBetterCount} ticks`,
  );
  if (b200ScoreWorseTicks.length > 0) {
    console.log(
      `  beam=200 has LOWER top score at ticks: ${b200ScoreWorseTicks.join(', ')}`,
    );
  }

  // Check for score plateaus (many states with the same score at top)
  console.log(`\n  --- Score plateau analysis ---`);
  for (
    let t = Math.max(1, dr.divergeTick - 2);
    t <= Math.min(MAX_TICKS, dr.divergeTick + 5);
    t++
  ) {
    for (const [label, snapshots] of [
      ['b50', dr.run50.snapshots],
      ['b200', dr.run200.snapshots],
    ] as const) {
      const snap = snapshots[t];
      if (!snap) continue;
      const topScore = snap.beamStates[0]?.score;
      const tiedCount = snap.beamStates.filter((s) => s.score === topScore).length;
      const totalBeam = snap.beamStates.length;
      if (tiedCount > 1) {
        console.log(
          `  Tick ${t} ${label}: ${tiedCount}/${totalBeam} states tied at top score=${topScore}`,
        );
      }
    }
  }
}

// ============================================================================
// STEP 4: SUMMARY / WRITE-UP
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('STEP 4: FINDINGS SUMMARY');
console.log('='.repeat(80));

console.log(`
REGRESSION CASES ANALYZED:
${detailedRuns.map((dr) => `  ${dr.caseName}: diverge@tick=${dr.divergeTick}, b50=${dr.run50.finalLand} vs b200=${dr.run200.finalLand}`).join('\n')}

DIVERGENCE PATTERNS:
`);

for (const dr of detailedRuns) {
  if (dr.divergeTick < 0) continue;
  const snap50pre = dr.run50.snapshots[dr.divergeTick - 1];
  const snap200pre = dr.run200.snapshots[dr.divergeTick - 1];
  const snap50at = dr.run50.snapshots[dr.divergeTick];
  const snap200at = dr.run200.snapshots[dr.divergeTick];

  const fps50pre = new Set(snap50pre.beamStates.map((s) => s.territoryFP)).size;
  const fps200pre = new Set(snap200pre.beamStates.map((s) => s.territoryFP)).size;

  console.log(`${dr.caseName}:`);
  console.log(
    `  Pre-diverge (tick ${dr.divergeTick - 1}): b50 has ${fps50pre} unique territories, b200 has ${fps200pre}`,
  );
  console.log(
    `  At diverge (tick ${dr.divergeTick}): b50 top=${snap50at.beamStates[0].score}/${snap50at.beamStates[0].land}L, b200 top=${snap200at.beamStates[0].score}/${snap200at.beamStates[0].land}L`,
  );
  console.log(
    `  Dedup ratio at diverge: b50=${snap50at.afterDedup}/${snap50at.totalCandidates}, b200=${snap200at.afterDedup}/${snap200at.totalCandidates}`,
  );
  console.log();
}

// ============================================================================
// EXPERIMENT A: Run WITHOUT dedup and compare
// ============================================================================

console.log('='.repeat(80));
console.log('EXPERIMENT A: WITH DEDUP vs WITHOUT DEDUP');
console.log('='.repeat(80));

for (const c of CASES) {
  const board = makeBoard(c.boardName);
  const withDedup50 = solveInstrumented(
    board.board,
    board.generalCoord,
    50,
    MAX_TICKS,
    c.scorerFn,
    true,
  );
  const withDedup200 = solveInstrumented(
    board.board,
    board.generalCoord,
    200,
    MAX_TICKS,
    c.scorerFn,
    true,
  );
  const noDedup50 = solveInstrumented(
    board.board,
    board.generalCoord,
    50,
    MAX_TICKS,
    c.scorerFn,
    false,
  );
  const noDedup200 = solveInstrumented(
    board.board,
    board.generalCoord,
    200,
    MAX_TICKS,
    c.scorerFn,
    false,
  );

  const dedupRegress = withDedup50.finalLand > withDedup200.finalLand;
  const noDedupRegress = noDedup50.finalLand > noDedup200.finalLand;

  console.log(`${c.boardName} / ${c.scorerName}:`);
  console.log(
    `  WITH dedup:    b50=${withDedup50.finalLand}  b200=${withDedup200.finalLand}  ${dedupRegress ? 'REGRESSION' : 'ok'}`,
  );
  console.log(
    `  WITHOUT dedup: b50=${noDedup50.finalLand}  b200=${noDedup200.finalLand}  ${noDedupRegress ? 'REGRESSION' : 'ok'}`,
  );
  console.log(
    `  Dedup causing it? ${dedupRegress && !noDedupRegress ? 'YES (dedup introduces regression)' : dedupRegress && noDedupRegress ? 'NO (pre-existing)' : 'N/A'}`,
  );
}

// ============================================================================
// EXPERIMENT B: Beam diversity at various ticks (dedup vs no-dedup)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT B: BEAM DIVERSITY -- UNIQUE STATES AT KEY TICKS');
console.log('='.repeat(80));

// Pick one representative case: sparse-mtns-7x7 / land-only
{
  const c = CASES[0]; // sparse-mtns-7x7 / land-only
  const board = makeBoard(c.boardName);

  const dedup200 = solveInstrumented(
    board.board,
    board.generalCoord,
    200,
    MAX_TICKS,
    c.scorerFn,
    true,
  );
  const nodedup200 = solveInstrumented(
    board.board,
    board.generalCoord,
    200,
    MAX_TICKS,
    c.scorerFn,
    false,
  );

  console.log(`\n${c.boardName} / ${c.scorerName} at beam=200:`);
  console.log('Tick | dedup: unique/total cands(deduped) | no-dedup: unique/total cands');
  console.log('-----|-------------------------------------|----------------------------');

  for (let t = 1; t <= MAX_TICKS; t++) {
    const sd = dedup200.snapshots[t];
    const sn = nodedup200.snapshots[t];
    const ud = new Set(sd.beamStates.map((s) => s.territoryFP)).size;
    const un = new Set(sn.beamStates.map((s) => s.territoryFP)).size;
    console.log(
      `  ${String(t).padStart(2)} | ` +
        `${String(ud).padStart(4)}/${String(sd.beamStates.length).padStart(4)}  cands=${String(sd.afterDedup).padStart(5)}/${String(sd.totalCandidates).padStart(5)} | ` +
        `${String(un).padStart(4)}/${String(sn.beamStates.length).padStart(4)}  cands=${String(sn.totalCandidates).padStart(5)}`,
    );
  }
}

// ============================================================================
// EXPERIMENT C: Beam width sweep to find regression shape
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('EXPERIMENT C: BEAM WIDTH SWEEP (shape of regression)');
console.log('='.repeat(80));

const SWEEP_WIDTHS = [10, 25, 50, 75, 100, 150, 200, 300, 500];

for (const c of CASES) {
  const board = makeBoard(c.boardName);
  const results: string[] = [];
  for (const bw of SWEEP_WIDTHS) {
    const r = solveInstrumented(
      board.board,
      board.generalCoord,
      bw,
      MAX_TICKS,
      c.scorerFn,
    );
    results.push(`b${bw}=${r.finalLand}`);
  }
  console.log(`${c.boardName} / ${c.scorerName}: ${results.join('  ')}`);
}

console.log('\n' + '='.repeat(80));
console.log('END OF ANALYSIS');
console.log('='.repeat(80));
