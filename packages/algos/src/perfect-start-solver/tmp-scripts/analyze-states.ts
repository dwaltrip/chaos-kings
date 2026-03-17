// @ts-nocheck
// Tmp script: analyze exact solver state space at early ticks.
// Run: npx tsx src/perfect-start-solver/tmp/analyze-states.ts [board] [maxTicks]

import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_TIMING } from '@core/game-timing-config';

import { cloneBoard } from '@/core-next/flat-board';
import { processStep } from '@/core-next/process-step';
import { fromBoardState } from '@/core-next/convert';

import { generateMoves, fingerprintState } from '../moves';
import { makeBoard } from '../test-boards';

const boardName = process.argv[2] || 'open-7x7';
const maxTicks = Number(process.argv[3]) || 10;

// -- Output helper -----------------------------------------------------------

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const logPath = path.join(dataDir, `${timestamp}-analyze-${boardName}-t${maxTicks}.log`);
const logStream = fs.createWriteStream(logPath);

function log(...args) {
  const line = args.map(String).join(' ');
  logStream.write(line + '\n');
  console.log(line);
}

const testBoard = makeBoard(boardName);
const timing = DEFAULT_TIMING;

// -- State tracking ----------------------------------------------------------

interface TrackedState {
  board: any; // FlatBoard
  fp: string;
  territoryFp: string; // which tiles are owned (ignoring army counts)
  land: number;
  totalExcess: number;
  generalArmy: number;
  frontierCount: number;
  frontierExcess: number;
  interiorExcess: number;
}

// Territory fingerprint: just which tiles are owned (1 bit per tile)
function territoryFingerprint(board): string {
  const n = board.width * board.height;
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (board.owners[i] === 0) buf[i] = 1;
  }
  return String.fromCharCode(...buf);
}

// Count frontier: blank tiles adjacent to owned territory
function countFrontier(board): number {
  const n = board.width * board.height;
  const seen = new Uint8Array(n);
  let count = 0;
  const dirs = [
    -board.width, // up
    board.width, // down
    -1, // left
    1, // right
  ];

  for (let i = 0; i < n; i++) {
    if (board.owners[i] !== 0) continue;
    for (const d of dirs) {
      const ni = i + d;
      if (ni < 0 || ni >= n) continue;
      // left/right bounds check
      if (d === -1 && i % board.width === 0) continue;
      if (d === 1 && i % board.width === board.width - 1) continue;
      if (seen[ni]) continue;
      if (board.types[ni] === 0 && board.owners[ni] === -1) {
        // blank + unowned
        seen[ni] = 1;
        count++;
      }
    }
  }
  return count;
}

// Compute excess on frontier vs interior tiles
function armyBreakdown(board): { frontierExcess: number; interiorExcess: number } {
  const n = board.width * board.height;
  const isFrontier = new Uint8Array(n);
  const dirs = [-board.width, board.width, -1, 1];

  // Mark owned tiles adjacent to blank as frontier
  for (let i = 0; i < n; i++) {
    if (board.owners[i] !== 0) continue;
    for (const d of dirs) {
      const ni = i + d;
      if (ni < 0 || ni >= n) continue;
      if (d === -1 && i % board.width === 0) continue;
      if (d === 1 && i % board.width === board.width - 1) continue;
      if (board.types[ni] === 0 && board.owners[ni] === -1) {
        isFrontier[i] = 1;
        break;
      }
    }
  }

  let frontierExcess = 0;
  let interiorExcess = 0;
  for (let i = 0; i < n; i++) {
    if (board.owners[i] !== 0) continue;
    const excess = board.units[i] - 1;
    if (excess <= 0) continue;
    if (isFrontier[i]) {
      frontierExcess += excess;
    } else {
      interiorExcess += excess;
    }
  }
  return { frontierExcess, interiorExcess };
}

function trackState(board, fp: string): TrackedState {
  const generalIdx = testBoard.generalCoord.y * board.width + testBoard.generalCoord.x;
  const land = board.stats.landCounts[0];
  const totalArmy = board.stats.armyCounts[0];
  const totalExcess = totalArmy - land; // each owned tile has minimum 1
  const generalArmy = board.units[generalIdx];
  const frontierCount = countFrontier(board);
  const { frontierExcess, interiorExcess } = armyBreakdown(board);

  return {
    board: cloneBoard(board),
    fp,
    territoryFp: territoryFingerprint(board),
    land,
    totalExcess,
    generalArmy,
    frontierCount,
    frontierExcess,
    interiorExcess,
  };
}

// -- BFS with full state capture ---------------------------------------------

const allTicks: Map<number, TrackedState>[] = [];

const board0 = fromBoardState(structuredClone(testBoard.board), 1);
const fp0 = fingerprintState(board0);
let states = new Map([[fp0, board0]]);
allTicks.push(new Map([[fp0, trackState(board0, fp0)]]));

log(`Analyzing ${boardName}, ${maxTicks} ticks\n`);

for (let tick = 1; tick <= maxTicks; tick++) {
  const nextStates = new Map();

  for (const [, board] of states) {
    const legalMoves = generateMoves({ board });
    for (const move of legalMoves) {
      const child = cloneBoard(board);
      processStep(child, move, 0, tick, timing);
      const fp = fingerprintState(child);
      if (!nextStates.has(fp)) {
        nextStates.set(fp, child);
      }
    }
  }

  states = nextStates;

  const tickStates = new Map();
  for (const [fp, board] of states) {
    tickStates.set(fp, trackState(board, fp));
  }
  allTicks.push(tickStates);
}

// -- Analysis ----------------------------------------------------------------

log('=== Territory Shape Distribution ===\n');
log('tick  |  states  |  territories  |  ratio (states/terr)  |  max variants');
log('-'.repeat(75));

for (let tick = 0; tick <= maxTicks; tick++) {
  const tickStates = allTicks[tick];
  const territories = new Map<string, TrackedState[]>();

  for (const state of tickStates.values()) {
    const list = territories.get(state.territoryFp) || [];
    list.push(state);
    territories.set(state.territoryFp, list);
  }

  const maxVariants = Math.max(...[...territories.values()].map((v) => v.length));

  log(
    `  ${String(tick).padStart(2)}  |` +
      `  ${String(tickStates.size).padStart(6)}  |` +
      `  ${String(territories.size).padStart(11)}  |` +
      `  ${(tickStates.size / territories.size).toFixed(1).padStart(19)}  |` +
      `  ${String(maxVariants).padStart(12)}`,
  );
}

log('\n=== State Property Distributions (final tick) ===\n');

const finalStates = [...allTicks[maxTicks].values()];

// Group by land count
const byLand = new Map<number, TrackedState[]>();
for (const s of finalStates) {
  const list = byLand.get(s.land) || [];
  list.push(s);
  byLand.set(s.land, list);
}

log(
  'land  |  count  |  avg genArmy  |  avg totalExcess  |  avg frontier  |  avg intExcess',
);
log('-'.repeat(90));

for (const [land, group] of [...byLand.entries()].sort((a, b) => a[0] - b[0])) {
  const avg = (fn) => (group.reduce((s, st) => s + fn(st), 0) / group.length).toFixed(1);
  log(
    `  ${String(land).padStart(2)}  |` +
      `  ${String(group.length).padStart(5)}  |` +
      `  ${avg((s) => s.generalArmy).padStart(12)}  |` +
      `  ${avg((s) => s.totalExcess).padStart(16)}  |` +
      `  ${avg((s) => s.frontierCount).padStart(13)}  |` +
      `  ${avg((s) => s.interiorExcess).padStart(13)}`,
  );
}

log('\n=== Within-Territory Variance (final tick, largest territories) ===\n');

const finalTerritories = new Map<string, TrackedState[]>();
for (const state of finalStates) {
  const list = finalTerritories.get(state.territoryFp) || [];
  list.push(state);
  finalTerritories.set(state.territoryFp, list);
}

// Show top 3 territories by variant count
const sortedTerritories = [...finalTerritories.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 3);

for (const [, variants] of sortedTerritories) {
  const first = variants[0];
  log(`Territory: land=${first.land}, ${variants.length} variants`);
  log('  genArmy  |  totalExcess  |  frontierExcess  |  interiorExcess');
  log('  ' + '-'.repeat(60));

  const sample = variants.sort((a, b) => b.totalExcess - a.totalExcess).slice(0, 10);
  for (const s of sample) {
    log(
      `  ${String(s.generalArmy).padStart(7)}  |` +
        `  ${String(s.totalExcess).padStart(12)}  |` +
        `  ${String(s.frontierExcess).padStart(15)}  |` +
        `  ${String(s.interiorExcess).padStart(14)}`,
    );
  }
  if (variants.length > 10) {
    log(`  ... and ${variants.length - 10} more`);
  }
  log();
}

// -- Tile-by-tile view of one territory group --------------------------------

log('=== Tile-by-Tile Army Placement (largest territory group, final tick) ===\n');

const [, largestGroup] = sortedTerritories[0];
const refBoard = largestGroup[0].board;
const w = refBoard.width;
const h = refBoard.height;

// Show the territory shape
log('Territory shape (O=owned, .=blank, M=mountain, G=general):');
const generalIdx = testBoard.generalCoord.y * w + testBoard.generalCoord.x;
for (let y = 0; y < h; y++) {
  let row = '  ';
  for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (i === generalIdx && refBoard.owners[i] === 0) row += 'G';
    else if (refBoard.owners[i] === 0) row += 'O';
    else if (refBoard.types[i] === 1) row += 'M';
    else row += '.';
  }
  log(row);
}

log(`\nArmy grids for each variant (${largestGroup.length} total, showing up to 8):\n`);

const showVariants = largestGroup
  .sort((a, b) => b.generalArmy - a.generalArmy)
  .slice(0, 8);

for (let vi = 0; vi < showVariants.length; vi++) {
  const s = showVariants[vi];
  const b = s.board;
  log(`  Variant ${vi + 1}: genArmy=${s.generalArmy}, totalExcess=${s.totalExcess}`);
  for (let y = 0; y < h; y++) {
    let row = '    ';
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (b.owners[i] === 0) {
        row += String(b.units[i]).padStart(2) + ' ';
      } else {
        row += ' . ';
      }
    }
    log(row);
  }
  log();
}

logStream.end();
console.log(`Log: ${path.relative(process.cwd(), logPath)}`);
