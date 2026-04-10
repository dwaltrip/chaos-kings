import { Board, type FlatBoard } from '@core-next/flat-board';

import { loadBoardCtx } from '../utils/board';
import { renderBoard } from '../utils/render-board';

import { buildStartingRegion } from './build';
import type { StartingRegion } from './types';

// The 7 boards from the session 2 matrix. Mirrors the lane-decomp
// heuristic evaluation so we can eyeball whether the starting-region
// annotations pick out the tiles we'd expect on each.
const BOARDS = [
  'pocket-11x11',
  'scattered-pockets-13x13',
  'corner-13x13',
  '3.21-real-board-tight-corner-1',
  '3-22.tight-edge-with-chokes',
  'sparse-mtns-11x11',
  '3.22-fairly-open',
];

function main(): void {
  // Optional CLI arg: substring filter on board name. No arg → all boards.
  // Example: `... debug-dump.ts tight-edge` runs tight-edge-with-chokes.
  const filter = process.argv[2];
  const boardsToRun = filter ? BOARDS.filter((name) => name.includes(filter)) : BOARDS;

  if (boardsToRun.length === 0) {
    console.error(`No board names match filter "${filter}".`);
    console.error(`Available boards:\n  ${BOARDS.join('\n  ')}`);
    process.exit(1);
  }

  for (const name of boardsToRun) {
    const { flatBoard, generalPos } = loadBoardCtx(name);
    const region = buildStartingRegion(flatBoard, generalPos);
    printBoardReport(name, flatBoard, region);
  }
}

function printBoardReport(name: string, board: FlatBoard, region: StartingRegion): void {
  const { x: gx, y: gy } = Board.toXY(board, region.general);
  const ann = region.annotations;

  const header = [
    `=== ${name} ===`,
    `general: (${gx}, ${gy}) @ idx ${region.general}`,
    `region size: ${region.tiles.size} tiles (maxDepth=${region.maxDepth})`,
    `max distance observed: ${maxValue(region.distance)}`,
    `articulation points: ${ann.articulationPoints.size} real / ${ann.rawArticulationCount} scoped (${ann.rawArticulationCount - ann.articulationPoints.size} filtered)`,
    `bridges: ${ann.bridges.length} real / ${ann.rawBridgeCount} scoped (${ann.rawBridgeCount - ann.bridges.length} filtered)`,
  ];
  console.log(header.join('\n'));

  console.log('\n-- distance field --');
  console.log(
    renderBoard(board, {
      crop: cropFromRegion(region),
      tileChar: (idx) => distanceChar(idx, region),
    }),
  );

  console.log('\n-- outward divergence --');
  console.log(
    renderBoard(board, {
      crop: cropFromRegion(region),
      tileChar: (idx) => scalarChar(idx, region, ann.outwardDivergence),
    }),
  );

  console.log('\n-- outward ray depth --');
  console.log(
    renderBoard(board, {
      crop: cropFromRegion(region),
      tileChar: (idx) => rayDepthChar(idx, region, ann.outwardRayDepth),
    }),
  );

  console.log('\n-- articulation points --');
  console.log(
    renderBoard(board, {
      crop: cropFromRegion(region),
      tileChar: (idx) => articulationChar(idx, region),
    }),
  );

  if (ann.bridges.length > 0) {
    const bridgeList = ann.bridges
      .map(([a, b]) => {
        const ax = Board.toXY(board, a);
        const bx = Board.toXY(board, b);
        return `(${ax.x},${ax.y})-(${bx.x},${bx.y})`;
      })
      .join('  ');
    console.log(`\nbridges: ${bridgeList}`);
  }

  console.log('\n');
}

// ── Character mapping helpers ──

function cropFromRegion(region: StartingRegion) {
  // Use the region's precomputed bbox as an explicit rectangle crop.
  return { kind: 'region' as const, ...region.bbox };
}

// Hex-ish: 0-9 then A-Z for distances ≥ 10 (up to 35 — well beyond our
// MAX_D of 13).
function distanceChar(idx: number, region: StartingRegion): string | null {
  if (idx === region.general) return 'G';
  if (!region.tiles.has(idx)) return null; // fall through to default (# or .)
  const d = region.distance.get(idx)!;
  if (d < 10) return String(d);
  return String.fromCharCode('A'.charCodeAt(0) + (d - 10));
}

function scalarChar(
  idx: number,
  region: StartingRegion,
  map: Map<number, number>,
): string | null {
  if (idx === region.general) return 'G';
  if (!region.tiles.has(idx)) return null;
  const v = map.get(idx);
  if (v == null) return null;
  if (v < 10) return String(v);
  return '+';
}

function rayDepthChar(
  idx: number,
  region: StartingRegion,
  map: Map<number, number>,
): string | null {
  if (idx === region.general) return 'G';
  if (!region.tiles.has(idx)) return null;
  const v = map.get(idx);
  if (v == null) return null;
  if (v < 10) return String(v);
  return '+';
}

function articulationChar(idx: number, region: StartingRegion): string | null {
  if (idx === region.general) return 'G';
  if (!region.tiles.has(idx)) return null;
  if (region.annotations.articulationPoints.has(idx)) return '*';
  return '·';
}

function maxValue(m: Map<number, number>): number {
  let best = 0;
  for (const v of m.values()) if (v > best) best = v;
  return best;
}

main();
