import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';

import type { Coord } from '@core/types';

import type { BoardStore } from './board-store';
import type { BoardSourceState, TileData } from './types';

function useTileData(store: BoardStore, coord: Coord): TileData {
  const subscribe = useCallback(
    (cb: () => void) => store.subscribeTile(coord, cb),
    [store, coord.x, coord.y],
  );
  const getSnapshot = useCallback(
    () => store.getTileData(coord),
    [store, coord.x, coord.y],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

function useBoardSourceState(store: BoardStore): BoardSourceState {
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const getSnapshot = useCallback(() => store.source, [store]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

export { useTileData, useBoardSourceState };
