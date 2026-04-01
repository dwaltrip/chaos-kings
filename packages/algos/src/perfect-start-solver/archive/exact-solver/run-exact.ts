import { makeBoard } from '../../test-boards';
import { solveExact } from './exact-solver';
import { formatMove } from '@/utils/format';

const boardName = process.argv[2] || 'open-7x7';
const maxTicks = Number(process.argv[3]) || 50;

const testBoard = makeBoard(boardName);

console.log(`Exact solver: ${boardName}, ${maxTicks} ticks`);
console.log();

const result = solveExact(testBoard.board, testBoard.generalCoord, { maxTicks });

console.log();
console.log(`Result: ${result.bestLand} land in ${Math.round(result.totalTimeMs)}ms`);
console.log(`Peak states: ${Math.max(...result.statesPerTick)}`);
console.log();
console.log('Moves:');
result.moves.forEach((move, i) => {
  console.log(`  tick ${String(i + 1).padStart(2)}: ${formatMove(move)}`);
});
