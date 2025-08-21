import type { Coord } from '@core/types';
import { TileContent } from '@/game-ui/components/tile-content';
import { useTileState } from '@/game-ui/hooks/use-tile-state';
import { useGameplay } from '@/game-ui/hooks/use-gameplay';

interface TileProps {
  coord: Coord;
}

function Tile({ coord }: TileProps) {
  const tileState = useTileState(coord);
  const { handleTileSelect } = useGameplay();

  const handleTileClick = () => handleTileSelect(coord);

  return (
    <TileContent
      square={tileState.square}
      isSelected={tileState.isSelected}
      isNeighborOfSelected={tileState.isNeighborOfSelected}
      isVisible={tileState.isVisible}
      isGeneral={tileState.isGeneral}
      onClick={handleTileClick}
      neighborVisibility={tileState.neighborVisibility}
      borders={tileState.borders}
    />
  );
}

export { Tile };
