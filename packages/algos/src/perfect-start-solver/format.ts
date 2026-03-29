import type { Coord } from '@core/types';

import type { Move } from './types';
import { FlatBoard, Board, TileType } from '@/core-next/flat-board';

// Auto-pad columns so they align vertically.
// Each row is an array of cell strings. Returns one joined string per row.
function alignColumns(rows: string[][], separator = '  '): string[] {
  const widths: number[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      widths[i] = Math.max(widths[i] ?? 0, row[i].length);
    }
  }
  return rows.map((row) =>
    row
      .map((cell, i) => cell.padEnd(widths[i]))
      .join(separator)
      .trimEnd(),
  );
}

function coordStr(c: Coord): string {
  return `(${c.x},${c.y})`;
}

function formatMove(move: Move): string {
  if (move === null) return 'WAIT';
  return `${coordStr(move.sourceCoord)}→${move.direction}`;
}

// Right-pad a number to a fixed width.
function num(n: number, width: number): string {
  return String(n).padStart(width);
}

// Markdown table with whitespace-aligned columns. Looks good raw or rendered.
function formatTable(headers: string[], rows: string[][]): string {
  const cols = headers.length;
  const widths: number[] = [];
  for (let i = 0; i < cols; i++) {
    widths[i] = headers[i].length;
    for (const row of rows) {
      widths[i] = Math.max(widths[i], (row[i] ?? '').length);
    }
  }

  const fmtRow = (cells: string[]) =>
    '| ' + cells.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |';
  const divider = '| ' + widths.map((w) => '-'.repeat(w)).join(' | ') + ' |';

  return [fmtRow(headers), divider, ...rows.map(fmtRow)].join('\n');
}

function formatBoard(board: FlatBoard) {
  let maxArmy = 0;
  Board.forEachTile(board, (tile) => {
    if (tile.units && tile.units > 0) {
      maxArmy = Math.max(maxArmy, tile.units);
    }
  });
  const useWideTiles = maxArmy > 9;

  const parts = Board.mapTiles2d(board, (tile) => {
    let part;
    switch (tile.type) {
      case TileType.BLANK:
        part = '.';
        break;
      case TileType.MOUNTAIN:
        part = '#';
        break;
      case TileType.GENERAL:
        part = 'G';
        break;
      case TileType.ARMY:
        part = tile.units < 100 ? '' + tile.units : '$$';
        break;
      default:
        console.error('Error: Unexpected tile.type:', tile.type);
        part = '?';
        break;
    }
    if (useWideTiles && part.length == 1) {
      return ' ' + part;
    }
    return part;
  });

  return parts.map((row) => row.join(' ')).join('\n');
}

function fmtObj(obj: Record<string, any>) {
  return (
    '{ ' +
    Object.entries(obj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ') +
    ' }'
  );
}

function round(value: number, decimals: number) {
  const pows_of_ten = Math.pow(10, decimals);
  return Math.round(value * pows_of_ten) / pows_of_ten;
}

export {
  alignColumns,
  coordStr,
  formatMove,
  formatTable,
  num,
  formatBoard,
  fmtObj,
  round,
};
