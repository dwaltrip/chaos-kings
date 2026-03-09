import type {
  BoardState as CoreBoardState,
  Coord,
  PlayerIndex,
  SquareType,
} from '@core/types';
import type { Player } from '@platform/domains/games/types';

import type { QueuedDirs } from './tile-derived-state';

interface BoardSourceState {
  board: CoreBoardState | null;
  tick: number;
  status: 'active' | 'ended';
  players: Player[];
  currentPlayerIndex: PlayerIndex | null;
  queuedMoves: import('@core/types').Movement[];
  playerStats: import('@core/types').CorePlayerState[];
  winner: PlayerIndex | null;
}

interface UIState {
  selectedTile: Coord | null;
}

// TODO: Tighten up naming — `BoardStoreState` vs `BoardState` from @core/types
interface BoardStoreState {
  source: BoardSourceState;
  ui: UIState;
}

interface DerivedState {
  visibleSquares: Set<string>;
  allVisible: boolean;
  queuedMovesMap: Map<string, QueuedDirs>;
}

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

export type { BoardSourceState, UIState, BoardStoreState, DerivedState, TileData };
