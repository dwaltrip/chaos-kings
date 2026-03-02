import type { BoardState, Coord, Movement } from '@core/types';

// import rawFrameData from '@/domains/game-ui-lab/data/lab-frames.json';
// import rawBoardStates from '@/domains/game-ui-lab/data/lab-board-states.json';

interface LabFrame {
  tick: number;
  queuedMoves: Movement[];
  selectedTile: Coord | null;
}

interface LabFrameData {
  frames: LabFrame[];
  playerIndex: number;
  config: { size: { width: number; height: number }; numPlayers: number };
}

const frameData = null as unknown as LabFrameData;
const boardStates = null as unknown as Record<string, BoardState>;

export type { LabFrame, LabFrameData };
export { frameData, boardStates };
