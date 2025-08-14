import { type PlayerSquare, type Coord } from '@core/types';
import { PlayerSquareLayout } from '@/game-ui/components/player-square';
import { ArmyCount } from '@/game-ui/components/army-count';

interface ArmySquareProps {
  square: PlayerSquare;
  coord: Coord;
  isSelected: boolean;
  onTileSelect: (coord: Coord) => void;
  isVisible: boolean;
}

function ArmySquare({
  square,
  coord,
  isSelected,
  onTileSelect,
  isVisible,
}: ArmySquareProps) {
  return (
    <PlayerSquareLayout
      className="army-square"
      playerIndex={square.playerIndex}
      isSelected={isSelected}
      onClick={() => onTileSelect(coord)}
      isVisible={isVisible}
    >
      <ArmyCount count={square.units} />
    </PlayerSquareLayout>
  );
}

export { ArmySquare };
