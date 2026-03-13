import type { Move } from './types';

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

function formatMove(move: Move): string {
  if (move === null) return 'WAIT';
  const { x, y } = move.sourceCoord;
  return `(${x},${y})→${move.direction}`;
}

// Right-pad a number to a fixed width.
function num(n: number, width: number): string {
  return String(n).padStart(width);
}

export { alignColumns, formatMove, num };
