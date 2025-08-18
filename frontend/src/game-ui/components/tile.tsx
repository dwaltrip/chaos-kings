import { isGeneralSquare, isPlayerSquare } from '@core/square';
import type { Coord, Square } from '@core/types';
import {
  debugTileClick,
  debugPlayerSquareClick,
} from '@/game-ui/utils/debug-utils';
import { TileContent } from '@/game-ui/components/tile-content';

interface TileProps {
  square: Square;
  coord: Coord;
  isSelected: boolean;
  isVisible: boolean;
  onTileSelect: (coord: Coord) => void;
}

function Tile({
  square,
  coord,
  isSelected,
  isVisible,
  onTileSelect,
}: TileProps) {
  const handleTileClick = () => {
    debugTileClick(coord);
    if (isPlayerSquare(square)) {
      debugPlayerSquareClick(isSelected);
    }
    onTileSelect(coord);
  };

  return (
    <TileContent
      square={square}
      isSelected={isSelected}
      isVisible={isVisible}
      isGeneral={isGeneralSquare(square)}
      onClick={handleTileClick}
    />
  );
}

export { Tile };
