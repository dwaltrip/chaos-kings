import generalIcon from '@/assets/crown.png';
import { type PlayerSquare, type Coord } from '@core/types';
import { PlayerSquareLayout } from '@/game-ui/components/player-square';
import { ArmyCount } from '@/game-ui/components/army-count';

interface GeneralProps {
  square: PlayerSquare;
  coord: Coord;
  isSelected: boolean;
  onTileSelect: (coord: Coord) => void;
  isVisible: boolean;
}

function General({
  square,
  coord,
  isSelected,
  onTileSelect,
  isVisible,
}: GeneralProps) {
  return (
    <PlayerSquareLayout
      className="general-icon"
      playerIndex={square.playerIndex}
      isSelected={isSelected}
      onClick={() => onTileSelect(coord)}
      isVisible={isVisible}
    >
      <img className="general-img" src={generalIcon} />
      <ArmyCount count={square.units} />
    </PlayerSquareLayout>
  );
}

export { General };
