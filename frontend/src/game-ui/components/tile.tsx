import { isGeneralSquare } from '@core/square';
import type { Coord, Square } from '@core/types';
import { TileContent } from '@/game-ui/components/tile-content';
import type { TileVisibilityData } from '@/game-ui/hooks/use-tile-neighbor-visibility';

interface TileProps {
  square: Square;
  coord: Coord;
  isSelected: boolean;
  isVisible: boolean;
  onTileSelect: (coord: Coord) => void;
  neighborVisibility: TileVisibilityData;
  isOnEdge: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
}

function Tile({
  square,
  coord,
  isSelected,
  isVisible,
  onTileSelect,
  neighborVisibility,
  isOnEdge,
}: TileProps) {
  const handleTileClick = () => onTileSelect(coord);
  return (
    <TileContent
      square={square}
      isSelected={isSelected}
      isVisible={isVisible}
      isGeneral={isGeneralSquare(square)}
      onClick={handleTileClick}
      neighborVisibility={neighborVisibility}
      isOnEdge={isOnEdge}
    />
  );
}

export { Tile };
