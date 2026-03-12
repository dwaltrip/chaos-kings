import type { Coord } from '@core/types';
import { SquareType } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

import { Board } from '@core/board';

import { createStore } from './lib/create-store';
import { deriveBoardState } from './derived';
import { computeTileData } from './tile-derived-state';
import { tilesEqual } from './tile-data';
import type {
  BoardSessionInputState,
  BoardSessionState,
  BoardSourceState,
  DerivedState,
  TileData,
} from './types';

function createDefaultGameState(): BoardSourceState {
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

function createDefaultUIState() {
  return { selectedTile: null, hasUserSelectedSinceLastQueue: false };
}

function createDefaultInputState(): BoardSessionInputState {
  return {
    game: createDefaultGameState(),
    ui: createDefaultUIState(),
  };
}

function createDefaultTileData(coord: Coord): TileData {
  return {
    coord,
    type: SquareType.BLANK,
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
    queuedUp: false,
    queuedDown: false,
    queuedLeft: false,
    queuedRight: false,
  };
}

function createBoardStore() {
  // NOTE: Tile cache + tile subs managed directly — can consider extracting
  // into a generic per-key abstraction if a second use case appears.
  const tileCache = new Map<string, TileData>();
  const tileSubs = new Map<string, Set<() => void>>();

  // NOTE: Centralized pipeline — one function iterates all tiles, diffs,
  // caches, and notifies. Chosen over per-tile selectors because controlling
  // the iteration enables optimizations you can't do when each subscriber
  // runs in isolation:
  // - Dirty regions: only recompute tiles affected by the mutation
  // - Spatial culling: skip tiles outside the viewport
  // - Direct buffer output: write to canvas/WebGL instead of TileData objects
  // These are all additive changes to runPipeline — no rearchitecting needed.

  function runPipeline(state: BoardSessionState): void {
    if (!state.game.board) return;

    Board.forEachCoord(state.game.board, (coord) => {
      const key = serializeCoord(coord);
      const next = computeTileData(state, coord);
      const prev = tileCache.get(key);

      if (!prev || !tilesEqual(prev, next)) {
        tileCache.set(key, next);
        const subs = tileSubs.get(key);
        if (subs) for (const cb of subs) cb();
      }
    });
  }

  // NOTE: Using `version` as the useSyncExternalStore snapshot. Technically
  // the snapshot should be the data itself for tearing protection, but this
  // should be fine — actions are synchronous and shouldn't be called mid-render.
  const store = createStore<BoardSessionInputState, DerivedState>({
    initialState: createDefaultInputState(),
    derive: deriveBoardState,
    onChange: runPipeline,
  });

  return {
    get state() {
      return store.state;
    },
    get derived() {
      return store.derived;
    },
    get version() {
      return store.version;
    },

    makeAction: store.makeAction,
    subscribe: store.subscribe,

    subscribeTile(coord: Coord, cb: () => void): () => void {
      const key = serializeCoord(coord);
      let subs = tileSubs.get(key);
      if (!subs) {
        subs = new Set();
        tileSubs.set(key, subs);
      }
      subs.add(cb);
      return () => {
        subs!.delete(cb);
      };
    },

    getTileData(coord: Coord): TileData {
      return tileCache.get(serializeCoord(coord)) ?? createDefaultTileData(coord);
    },

    // NOTE: Clears tile subscribers, assuming components have unmounted before
    // reset (e.g. page navigation). If a future flow keeps the board mounted,
    // a React key on the board component can force unmount/remount.
    reset() {
      tileCache.clear();
      tileSubs.clear();
      store.reset(createDefaultInputState());
    },
  };
}

type BoardStoreInstance = ReturnType<typeof createBoardStore>;

export type { BoardStoreInstance };
export { createBoardStore, createDefaultTileData };
