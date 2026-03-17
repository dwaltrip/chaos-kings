// @ts-nocheck
// Dump all board states per tick to individual files.
// Run: npx tsx src/perfect-start-solver/tmp/dump-states.ts [board] [maxTicks]

import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_TIMING } from '@core/game-timing-config';

import { cloneBoard } from '@/core-next/flat-board';
import { processStep } from '@/core-next/process-step';
import { fromBoardState } from '@/core-next/convert';

import { generateMoves, fingerprintState } from '../moves';
import { makeBoard } from '../test-boards';

const boardName = process.argv[2] || 'open-7x7';
const maxTicks = Number(process.argv[3]) || 12;

const testBoard = makeBoard(boardName);
const timing = DEFAULT_TIMING;
const generalIdx =
  testBoard.generalCoord.y * testBoard.board.size.width + testBoard.generalCoord.x;

const outDir = path.join(__dirname, 'data', `states-${boardName}-t${maxTicks}`);
fs.mkdirSync(outDir, { recursive: true });

function renderBoard(board): string {
  const w = board.width;
  const h = board.height;
  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '  ';
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (board.owners[i] === 0) {
        row += String(board.units[i]).padStart(2) + ' ';
      } else if (board.types[i] === 1) {
        row += ' M ';
      } else {
        row += ' . ';
      }
    }
    lines.push(row);
  }
  return lines.join('\n');
}

function writeTickFile(tick: number, boards: Map<string, any>) {
  const filePath = path.join(outDir, `tick-${String(tick).padStart(2, '0')}.txt`);
  const lines: string[] = [];

  lines.push(`Tick ${tick}: ${boards.size} states`);
  lines.push(`Board: ${boardName}`);
  lines.push('');

  let idx = 0;
  for (const board of boards.values()) {
    idx++;
    const land = board.stats.landCounts[0];
    const totalArmy = board.stats.armyCounts[0];
    const totalExcess = totalArmy - land;
    const genArmy = board.units[generalIdx];

    lines.push(
      `State ${idx}/${boards.size}: land=${land}, totalExcess=${totalExcess}, genArmy=${genArmy}`,
    );
    lines.push(renderBoard(board));
    lines.push('');
  }

  fs.writeFileSync(filePath, lines.join('\n'));
}

// -- BFS ---------------------------------------------------------------------

let states = new Map<number, any>();
const board0 = fromBoardState(structuredClone(testBoard.board), 1);
states.set(fingerprintState(board0), board0);
writeTickFile(0, states);
console.log(`tick  0: ${String(states.size).padStart(6)} states`);

for (let tick = 1; tick <= maxTicks; tick++) {
  const nextStates = new Map();

  for (const board of states.values()) {
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
  writeTickFile(tick, states);
  console.log(
    `tick ${String(tick).padStart(2)}: ${String(states.size).padStart(6)} states`,
  );
}

console.log(`\nFiles written to: ${path.relative(process.cwd(), outDir)}/`);
