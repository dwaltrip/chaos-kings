import type {
  BoardState,
  Coord,
  CorePlayerState,
  Movement,
  PlayerIndex,
} from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';
import type { Player } from '@platform/domains/games/types';

import { computeDerivedState, computeFrameAndDiff } from './frame-computation';
import { EMPTY_DIRECTIONS } from './tile-data';
import type {
  BoardSourceState,
  DerivedState,
  FrameDiff,
  TileData,
  UIState,
} from './types';

function createDefaultSourceState(): BoardSourceState {
  return {
    board: null,
    tick: 0,
    status: 'active',
    players: [],
    currentPlayerIndex: null,
    queuedMoves: [],
    playerStats: [],
    winner: null,
  };
}

function createDefaultUIState(): UIState {
  return { selectedTile: null };
}

function createDefaultDerivedState(): DerivedState {
  return { visibleSquares: new Set<string>(), allVisible: false };
}

function createDefaultTileData(coord: Coord): TileData {
  return {
    coord,
    type: 'BLANK',
    playerIndex: -1,
    armyCount: 0,
    isVisible: false,
    neighborVisTop: false,
    neighborVisLeft: false,
    isSelected: false,
    isSelectable: false,
    isValidMove: false,
    hasTopBorder: false,
    hasLeftBorder: false,
    queuedDirections: EMPTY_DIRECTIONS,
  };
}

class BoardStore {
  public source: BoardSourceState;
  public ui: UIState;
  public derived: DerivedState;
  public width: number;
  public height: number;
  public frame: TileData[];
  private tileDataCache: Map<string, TileData>;
  private tileSubscribers: Map<string, Set<() => void>>;
  private boardSubscribers: Set<() => void>;

  constructor() {
    this.source = createDefaultSourceState();
    this.ui = createDefaultUIState();
    this.derived = createDefaultDerivedState();
    this.width = 0;
    this.height = 0;
    this.frame = [];
    this.tileDataCache = new Map();
    this.tileSubscribers = new Map();
    this.boardSubscribers = new Set();
  }

  init(
    players: Player[],
    currentPlayerIndex: PlayerIndex | null,
    board?: BoardState,
  ): FrameDiff {
    this.source.players = players;
    this.source.currentPlayerIndex = currentPlayerIndex;

    if (board) {
      this.source.board = board;
      this.width = board.size.width;
      this.height = board.size.height;
      this.frame = new Array(this.width * this.height);
      return this.applyUpdate();
    }

    return [];
  }

  applyTick(
    tick: number,
    board: BoardState,
    queuedMoves: Movement[],
    playerStats: CorePlayerState[],
    winner?: PlayerIndex,
  ): FrameDiff {
    // Dimensions must be set by init() before ticks can be processed
    if (this.width === 0) return [];
    this.source.tick = tick;
    this.source.board = board;
    this.source.queuedMoves = queuedMoves;
    this.source.playerStats = playerStats;
    if (winner != null) {
      this.source.winner = winner;
    }
    return this.applyUpdate();
  }

  setStatus(status: 'active' | 'ended'): FrameDiff {
    this.source.status = status;
    return this.applyUpdate();
  }

  setSelectedTile(coord: Coord | null): FrameDiff {
    this.ui.selectedTile = coord;
    return this.applyUpdate();
  }

  addQueuedMove(move: Movement): FrameDiff {
    this.source.queuedMoves = [...this.source.queuedMoves, move];
    return this.applyUpdate();
  }

  setQueuedMoves(moves: Movement[]): FrameDiff {
    this.source.queuedMoves = moves;
    return this.applyUpdate();
  }

  undoLastQueuedMove(): FrameDiff {
    this.source.queuedMoves = this.source.queuedMoves.slice(0, -1);
    return this.applyUpdate();
  }

  reset(): void {
    this.source = createDefaultSourceState();
    this.ui = createDefaultUIState();
    this.derived = createDefaultDerivedState();
    this.width = 0;
    this.height = 0;
    this.frame = [];
    this.tileDataCache.clear();
    this.tileSubscribers.clear();
    this.boardSubscribers.clear();
  }

  subscribeTile(coord: Coord, callback: () => void): () => void {
    const key = serializeCoord(coord);
    let subscribers = this.tileSubscribers.get(key);
    if (!subscribers) {
      subscribers = new Set();
      this.tileSubscribers.set(key, subscribers);
    }
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }

  subscribe(callback: () => void): () => void {
    this.boardSubscribers.add(callback);
    return () => this.boardSubscribers.delete(callback);
  }

  getTileData(coord: Coord): TileData {
    const key = serializeCoord(coord);
    return this.tileDataCache.get(key) ?? createDefaultTileData(coord);
  }

  // Future: if back-to-back ticks cause issues, queue them and apply on rAF boundary
  private applyUpdate(): FrameDiff {
    if (!this.source.board) return [];

    this.derived = computeDerivedState(this.source, this.ui);

    const inputs = { source: this.source, ui: this.ui, derived: this.derived };
    const diff = computeFrameAndDiff(inputs, this.frame, this.width, this.height);

    this.updateTileDataCache(diff);
    this.notifyChangedTiles(diff);

    // New object reference so useSyncExternalStore snapshot comparison detects changes
    this.source = { ...this.source };

    this.notifyBoardSubscribers();

    return diff;
  }

  private updateTileDataCache(diff: FrameDiff): void {
    for (const change of diff) {
      this.tileDataCache.set(serializeCoord(change.coord), change.data);
    }
  }

  private notifyChangedTiles(diff: FrameDiff): void {
    for (const change of diff) {
      const key = serializeCoord(change.coord);
      const subscribers = this.tileSubscribers.get(key);
      if (subscribers) {
        for (const cb of subscribers) {
          cb();
        }
      }
    }
  }

  private notifyBoardSubscribers(): void {
    for (const cb of this.boardSubscribers) {
      cb();
    }
  }
}

const boardStore = new BoardStore();

export { BoardStore, boardStore };
