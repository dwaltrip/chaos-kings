// Thread 7: Graph topology analysis across all boards.
// Global topology: articulation points, corridors, region decomposition.
//
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/3.23-1-graph-topology.ts

import { Board, type FlatBoard, TileType } from '@/core-next/flat-board';
import { Direction } from '@core/types';
import { fromBoardState } from '@/core-next/convert';

import {
  decomposeRegions,
  findCorridors,
  getWalkableDegree,
  getWalkableTiles,
  tarjan,
} from '../../utils/board-graph';
import { formatTable } from '../../format';
import { solveV3 } from '../../custom-algo-1/solver-v3';
import { simpleBoards, realisticBoards, type TestBoard } from '../../test-boards';

// ── Analysis ──

interface BoardAnalysis {
  name: string;
  size: string;
  walkable: number;
  genDeg: number;
  solveMs: number;
  captures: number;
  corridorTiles: number;
  corridorSegs: number;
  artPts: number;
  regions: number;
  regionSizes: number[];
}

function analyzeBoard(tb: TestBoard): BoardAnalysis {
  const board = fromBoardState(tb.board, 1);
  const generalPos = Board.toIndex(board, tb.generalCoord.x, tb.generalCoord.y);

  const walkable = getWalkableTiles(board);
  const genDeg = getWalkableDegree(board, generalPos);
  const corridors = findCorridors(board);
  const { articulationPoints } = tarjan(board);
  const { regions } = decomposeRegions(board, articulationPoints);

  const result = solveV3(board, generalPos);
  const solveMs = result.elapsedMs;
  const captures = result.solution?.totalCaptured ?? 0;

  const regionSizes = regions.map((r) => r.tiles.size).sort((a, b) => b - a);

  return {
    name: tb.name,
    size: `${board.width}x${board.height}`,
    walkable: walkable.length,
    genDeg,
    solveMs,
    captures,
    corridorTiles: corridors.corridorTiles.size,
    corridorSegs: corridors.segments.length,
    artPts: articulationPoints.size,
    regions: regions.length,
    regionSizes,
  };
}

// ── Formatting ──

function fmtMs(ms: number): string {
  return ms < 10 ? ms.toFixed(1) : String(Math.round(ms));
}

function fmtRegionSizes(sizes: number[]): string {
  if (sizes.length <= 6) return sizes.join(', ');
  return sizes.slice(0, 6).join(', ') + ` ... (+${sizes.length - 6})`;
}

function printTable(title: string, analyses: BoardAnalysis[]): void {
  const sorted = [...analyses].sort((a, b) => a.solveMs - b.solveMs);

  const headers = [
    'Board',
    'Size',
    'Walk',
    'Deg',
    'Ms',
    'Cap',
    'CorrT',
    'CorrS',
    'ArtPt',
    'Rgns',
    'Region sizes',
  ];

  const rows = sorted.map((r) => [
    r.name,
    r.size,
    String(r.walkable),
    String(r.genDeg),
    fmtMs(r.solveMs),
    String(r.captures),
    String(r.corridorTiles),
    String(r.corridorSegs),
    String(r.artPts),
    String(r.regions),
    fmtRegionSizes(r.regionSizes),
  ]);

  console.log(`\n## ${title}\n`);
  console.log(formatTable(headers, rows));
}

// ── Run ──

const simpleResults = simpleBoards().map(analyzeBoard);
const realisticResults = realisticBoards().map(analyzeBoard);

printTable('Simple boards (7x7 - 13x13)', simpleResults);
printTable('Realistic boards (25x25 - 30x30)', realisticResults);
