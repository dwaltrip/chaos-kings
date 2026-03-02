import type {
  BoardState,
  Coord,
  CorePlayerState,
  Direction,
  Movement,
  PlayerIndex,
  SquareType,
} from '@core/types';
import type { Player } from '@platform/domains/games/types';

interface BoardSourceState {
  board: BoardState | null;
  tick: number;
  status: 'active' | 'ended';
  players: Player[];
  currentPlayerIndex: PlayerIndex | null;
  queuedMoves: Movement[];
  playerStats: CorePlayerState[];
  winner: PlayerIndex | null;
}

interface UIState {
  selectedTile: Coord | null;
}

interface DerivedState {
  visibleSquares: Set<string>;
  allVisible: boolean;
}

interface FrameInputs {
  source: BoardSourceState;
  ui: UIState;
  derived: DerivedState;
}

interface TileData {
  coord: Coord;
  type: SquareType;
  playerIndex: number;
  armyCount: number;
  isVisible: boolean;
  neighborVisTop: boolean;
  neighborVisLeft: boolean;
  isSelected: boolean;
  isSelectable: boolean;
  isValidMove: boolean;
  hasTopBorder: boolean;
  hasLeftBorder: boolean;
  queuedDirections: Set<Direction>;
}

interface TileChange {
  coord: Coord;
  index: number;
  data: TileData;
}

type FrameDiff = TileChange[];

export type {
  BoardSourceState,
  UIState,
  DerivedState,
  FrameInputs,
  TileData,
  TileChange,
  FrameDiff,
};
