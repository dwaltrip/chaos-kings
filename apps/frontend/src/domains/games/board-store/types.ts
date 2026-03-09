import type {
  BoardState as CoreBoardState,
  Coord,
  CorePlayerState,
  Movement,
  PlayerIndex,
  SquareType,
} from '@core/types';
import type { Player } from '@platform/domains/games/types';

// TODO: Revisit internal type names (BoardSourceState, BoardSessionInputState, DerivedState).
// Also: core's BoardState → TileGrid ({ grid, size }), GameGrid → Tile[][] or Square[][].
// "Square" is vague — "Tile" better matches how we think about it now.

interface BoardSourceState {
  board: CoreBoardState | null;
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

interface BoardSessionInputState {
  game: BoardSourceState;
  ui: UIState;
}

interface QueuedDirs {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

interface DerivedState {
  visibleSquares: Set<string>;
  allVisible: boolean;
  queuedMovesMap: Map<string, QueuedDirs>;
}

type BoardSessionState = BoardSessionInputState & DerivedState;

// Future: could be populated from flat number arrays at the network boundary
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
  queuedUp: boolean;
  queuedDown: boolean;
  queuedLeft: boolean;
  queuedRight: boolean;
}

export type {
  BoardSourceState,
  UIState,
  BoardSessionInputState,
  QueuedDirs,
  DerivedState,
  BoardSessionState,
  TileData,
};
