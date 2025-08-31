import type { Coord } from '@core/types';
import { areCoordsEqual } from '@core/utils/coordinate-utils';
import { create } from 'zustand';

interface GameplayStateV2 {
  selectedTile: Coord | null;

  // QUESTION: TS doesn't seem to complain if I don't define these here?
  actions: {
    setSelectedTileV2: (coord: Coord) => void;
    clearSelectedTile: () => void;
  };
}

const useGameplayStoreV2 = create<GameplayStateV2>((set) => ({
  selectedTile: null,

  actions: {
    setSelectedTileV2: (coord: Coord) => set({ selectedTile: coord }),
    clearSelectedTile: () => set({ selectedTile: null }),
  },
}));

// ----------- Selectors -----------

const useSelectedTile = (state: GameplayStateV2) => state.selectedTile;

const useIsTileSelected = (coord: Coord) => (state: GameplayStateV2) => {
  const { selectedTile } = state;
  return areCoordsEqual(selectedTile, coord);
};

// const useSelectTileAtCoord = (coord: Coord) => (state: GameplayStateV2) => {
//   const { setSelectedTileV2 } = state.actions;
//   return () => setSelectedTileV2(coord);
// };

export {
  useGameplayStoreV2,
  useSelectedTile,
  useIsTileSelected,
  // useSelectTileAtCoord,
};
