// Solution prefix spot-check.
// For each board, runs the solver, then for each burst in the solution shows
// how fan-out narrows as prefix depth increases from 1 to 4.
//
// Usage:
//   npx tsx .../3.23-3-solution-spot-check.ts              # default boards
//   npx tsx .../3.23-3-solution-spot-check.ts slow          # slow boards
//   npx tsx .../3.23-3-solution-spot-check.ts corner-9x9    # single board

import { Board, type FlatBoard } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { getWalkableNeighbors } from '../../utils/board-graph';
import { solveV3 } from '../../custom-algo-1/solver-v3';
import { formatTable } from '@/utils/format';
import {
  makeBoard,
  allBoards,
  simpleBoards,
  realisticBoards,
  slowSearch,
  type TestBoard,
} from '../../test-boards';
import { buildFanoutMap, enumeratePrefixes, prefixKey } from '../prefix-utils';

// ── Config ──

const MAX_PREFIX_DEPTH = 4;
const FANOUT_TARGETS = [8, 10, 12];
const MAX_PATH_LEN = 12;

const DEFAULT_NAMES = [
  'open-7x7',
  'sparse-mtns-9x9',
  '3.21-real-board-medium-spacious',
  '3.22-fairly-open',
  'corner-9x9',
  'pocket-11x11',
  'pocket-2-11x11',
  'corner-13x13',
  '3.21-real-board-tight-corner-1',
  '3.21-real-board-tight-corner-2',
];

// ── Board resolution (same as prefix-enumeration) ──

const BOARD_SETS: Record<string, () => TestBoard[]> = {
  slow: slowSearch,
  realistic: realisticBoards,
  simple: simpleBoards,
  all: allBoards,
};

function resolveBoards(args: string[]): TestBoard[] {
  if (args.length === 0) {
    return DEFAULT_NAMES.map((name) => makeBoard(name));
  }
  const seen = new Set<string>();
  const boards: TestBoard[] = [];
  for (const arg of args) {
    const setFn = BOARD_SETS[arg];
    const list = setFn ? setFn() : [makeBoard(arg)];
    for (const tb of list) {
      if (!seen.has(tb.name)) {
        seen.add(tb.name);
        boards.push(tb);
      }
    }
  }
  return boards;
}

// ── Helpers ──

function tileXY(board: FlatBoard, tile: number): string {
  const x = tile % board.width;
  const y = Math.floor(tile / board.width);
  return `(${x},${y})`;
}

function fmtMs(ms: number): string {
  return ms < 10 ? ms.toFixed(1) : String(Math.round(ms));
}

// ── Main ──

const boards = resolveBoards(process.argv.slice(2));

console.log('# Solution Prefix Spot-Check\n');

for (const tb of boards) {
  const board = fromBoardState(tb.board, 1);
  const generalPos = Board.toIndex(board, tb.generalCoord.x, tb.generalCoord.y);

  console.error(`  ${tb.name}...`);

  const result = solveV3(board, generalPos);
  const solution = result.solution;

  if (!solution) {
    console.log(`**${tb.name}** — no solution\n`);
    continue;
  }

  const { entriesByLen } = enumeratePrefixes(
    board,
    generalPos,
    MAX_PREFIX_DEPTH,
    MAX_PATH_LEN,
  );

  // Pre-build fanout maps for all (depth, target) combos
  const fanoutMaps = new Map<string, Map<string, number>>();
  for (let d = 1; d <= MAX_PREFIX_DEPTH; d++) {
    for (const tgt of FANOUT_TARGETS) {
      if (tgt <= d) continue;
      fanoutMaps.set(`${d},${tgt}`, buildFanoutMap(entriesByLen, d, tgt));
    }
  }

  const pattern = solution.pattern.join(', ');
  const overlaps = solution.burstSpecs.map((s) => s.moves - s.captures);
  console.log(
    `**${tb.name}** (cap=${solution.totalCaptured}, pattern=[${pattern}], ${fmtMs(result.elapsedMs)}ms)`,
  );

  for (let bi = 0; bi < solution.paths.length; bi++) {
    const path = solution.paths[bi];
    const captures = solution.pattern[bi];
    const overlap = overlaps[bi];
    const maxD = Math.min(path.tiles.length, MAX_PREFIX_DEPTH);

    console.log(`\nBurst ${bi + 1}: ${captures} captures, overlap=${overlap}`);

    const fanoutHeaders = FANOUT_TARGETS.map((t) => `→${t}`);
    const headers = ['Depth', 'Prefix', 'TipDeg', 'Free', ...fanoutHeaders];

    const rows: string[][] = [];
    for (let d = 1; d <= maxD; d++) {
      const pfxTiles = path.tiles.slice(0, d);
      const tip = pfxTiles[d - 1];
      const tipNeighbors = getWalkableNeighbors(board, tip);
      const tipDeg = tipNeighbors.length;
      const pathSet = new Set([generalPos, ...pfxTiles]);
      const free = tipNeighbors.filter((nb) => !pathSet.has(nb)).length;

      const pfxStr = pfxTiles.map((t) => tileXY(board, t)).join('→');
      const fanoutValues = FANOUT_TARGETS.map((tgt) => {
        if (tgt <= d) return '-';
        const fmap = fanoutMaps.get(`${d},${tgt}`);
        if (!fmap) return '-';
        return String(fmap.get(prefixKey(pfxTiles, d)) ?? 0);
      });

      rows.push([String(d), pfxStr, String(tipDeg), String(free), ...fanoutValues]);
    }

    console.log(formatTable(headers, rows));
  }

  console.log('\n---\n');
}
