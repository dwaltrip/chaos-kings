import type { Coord } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

import { Board } from '@core/board';

import { createStore } from './lib/create-store';
import { deriveBoardState } from './derived';
import { computeTileData } from './tile-derived-state';
import { tilesEqual } from './tile-data';
import type { BoardStoreState, DerivedState, TileData } from './types';

function createDefaultSourceState() {
  return {
    board: null,
    tick: 0,
    status: 'active' as const,
    players: [] as any[],
    currentPlayerIndex: null,
    queuedMoves: [] as any[],
    playerStats: [] as any[],
    winner: null,
  };
}

function createDefaultUIState() {
  return { selectedTile: null };
}

function createDefaultBoardStoreState(): BoardStoreState {
  return {
    source: createDefaultSourceState(),
    ui: createDefaultUIState(),
  };
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
    queuedUp: false,
    queuedDown: false,
    queuedLeft: false,
    queuedRight: false,
  };
}

function createBoardStore() {
  // NOTE: Tile cache + tile subscribers are managed directly here rather
  // than extracted into a generic abstraction. If a second per-key
  // subscription use case appears (per-player stats, per-territory
  // aggregates), extract the pattern then with a real use case to
  // guide the API.
  const tileCache = new Map<string, TileData>();
  const tileSubs = new Map<string, Set<() => void>>();

  // NOTE: Pipeline optimization. Currently iterates all tiles on every
  // action. Future optimization paths (all additive, no rearchitecting):
  // - Dirty regions: snapshot selectedTile before mutation, only recompute
  //   affected tiles
  // - Spatial culling: skip tiles outside viewport for large/scrollable maps
  // - Direct buffer output: write to canvas/WebGL render buffer instead of
  //   (or alongside) TileData objects

  // NOTE: Re-entrancy risk: if a subscriber triggers another action during
  // notification, runPipeline would be called recursively. Not guarded yet —
  // add a re-entrancy guard if this becomes an issue.
  function runPipeline(_merged: BoardStoreState & DerivedState): void {
    const { state, derived } = store;
    if (!state.source.board) return;

    Board.forEachCoord(state.source.board, (coord) => {
      const key = serializeCoord(coord);
      const next = computeTileData(state, derived, coord);
      const prev = tileCache.get(key);

      if (!prev || !tilesEqual(prev, next)) {
        tileCache.set(key, next);
        const subs = tileSubs.get(key);
        if (subs) for (const cb of subs) cb();
      }
    });
  }

  // NOTE: Version counter as useSyncExternalStore snapshot.
  // Using `version` as the snapshot works for triggering re-renders but
  // doesn't fully match React's tearing protection contract. In practice
  // this is fine — actions run on the main thread between React work units.
  // Fallback if needed: shallow-copy the state container after each action
  // so the reference itself serves as the snapshot.
  const store = createStore<BoardStoreState, DerivedState>({
    initialState: createDefaultBoardStoreState(),
    derive: deriveBoardState,
    onChange: runPipeline,
    // NOTE: Reset clears tile subscribers. This assumes components have
    // unmounted before reset (e.g. page navigation). For a future "play again"
    // flow where the board stays mounted, use a React key on the board
    // component (<GameBoard key={gameId} />) to force unmount/remount.
    onReset() {
      tileCache.clear();
      tileSubs.clear();
    },
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

    reset() {
      store.reset(createDefaultBoardStoreState());
    },
  };
}

type BoardStoreInstance = ReturnType<typeof createBoardStore>;

export type { BoardStoreInstance };
export { createBoardStore, createDefaultTileData };
