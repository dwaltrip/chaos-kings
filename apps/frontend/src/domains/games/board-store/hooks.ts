import { useCallback, useSyncExternalStore } from 'react';

import type { Coord } from '@core/types';

import type { BoardStoreInstance } from './board-store';
import type { BoardStoreState, TileData } from './types';

function useTileData(store: BoardStoreInstance, coord: Coord): TileData {
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

function useBoardState(store: BoardStoreInstance): BoardStoreState {
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const getSnapshot = useCallback(() => store.version, [store]);
  useSyncExternalStore(subscribe, getSnapshot);
  return store.state;
}

export { useTileData, useBoardState };
