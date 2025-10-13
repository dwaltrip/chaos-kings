# UI performance idea v2

## Background

Right now, we have some serious performance issues w/ tiles re-rendering far too often. My plan to fix this is to create tile-level 
stores that hold all the derived state needed for rendering GameTile.

Each piece of state in the tileStore should all be primitive values or at most have 1-level of nesting to get to primitive value (e.g. the value could be an
array of primitive values, or an object where all keys point to primitive values, but not an array of objects). We can then use `useShallow` (from zustand v5) to ensure that ONLY the tiles who have genuinely new data will re-render. The "same" data in newly 
constructed objects or arrays shouldn't cause re-renders. This might end up being a fairly big refactor.

NOTE: since we are on Zustand v5, we can't naively use the old v4 pattern of:

```ts
const someState = useStore(
  state => state.someState,
  // custom equality function -- doens't work in v5!!
  isSomeStateEqual,
);
```

Also, you may see some messy code, we were trying a number of different things. If you aren't sure ask me about it. Try to not naively assume every piece of existing code is correct.

## Rough sketch of what I'm thinking:

```ts
interface TileState {
  isSelected: boolean;
  unitCount: number | null;
  queuedMoves: Set<Direction>,
  playerId: string | null;
  // etc...
}

interface GameBoardState {
  // ...
}
```


```ts
// game-board-store.ts
const gameBoardStore = create<GameBoardState>((set) => ({
  actions: {
    // This will be triggered by the backend on every game state update via WebSocket
    // The backend will send the ENTIRE board state
    // This is why we will need to use `useShallow` for each piece of state in the tile stores
    updateBoard: ((newBoardState) => {
      const dataPerTile: Map<Coord, TileState> = buildTileLevelData(newBoardState);

      dataPerTile.entries().forEach(([coord, state]) => {
        const tileStore = getOrCreateTileStore(coord);
        tileStore.update(state);
      });
    }),
  },
}));

const useGameBoardStore = gameBoardStore;

```


```ts
// TODO: where does this live?? who owns it? Maybe the GamePage? How does 'game-board-store.ts' access it?
const tileStores = new Map<string, TileStore>();

function getOrCreateTileStore(coord: Coord): TileStore {
  const existingStore = tileStores.get(`${coord.x},${coord.y}`);
  if (existingStore) {
    return existingStore;
  }
  const newStore = createTileStore(coord, 'empty');
  tileStores.set(`${coord.x},${coord.y}`, newStore);
  return newStore;
}

// zustand store
const tileStore = create<TileState>((set) => ({
  isSelected: false,
  unitCount: null,
  queuedMoves: new Set<Direction>(),
  playerId: null,
  update: (newState: Partial<TileState>) => set((state) => ({ ...state, ...newState

}));

const useTileStore = tileStore;


function useTileStoreForCoord(coord: Coord) {
  const tileStore = getOrCreateTileStore(coord);
  return tileStore;
};

function useIsSelected(coord: Coord) {
  const tileStore = useTileStoreForCoord(coord);
  return tileStore.isSelected;
}

function useUnitCount(coord: Coord) {
  const tileStore = useTileStoreForCoord(coord);
  return tileStore.unitCount;
}

function useQueuedMoves(coord: Coord) {
  const tileStore = useTileStoreForCoord(coord);
  // NOTE: I think this is necessary to avoid unnecessary re-renders
  // and queued moves MUST be an array / set of primitive values!
  return useShallow(tileStore.queuedMoves);
}
```
