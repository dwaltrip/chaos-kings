import { type BoardState, type Coord, PlayerSquareType } from '@core/types';
import { isPlayerSquare } from '@core/square';
import {
  isSquareVisible,
  shouldShowMountain,
} from '@/game-ui/utils/visibility-utils';
import { SquareView } from '@/game-ui/components/square-view';
import { PlayerSquareView } from '@/game-ui/components/player-square';
import { General } from '@/game-ui/components/general';
import { ArmySquare } from '@/game-ui/components/army-square';

interface GameBoardProps {
  boardState: BoardState;
  selectedTile: Coord | null;
  onTileSelect: (coord: Coord) => void;
  currentPlayerIndex: number | null;
  visibleSquares: Set<Coord>;
}

function GameBoard({
  boardState,
  selectedTile,
  onTileSelect,
  currentPlayerIndex,
  visibleSquares,
}: GameBoardProps) {
  const grid = boardState.grid;
  const gridRows = grid.length;
  const gridCols = grid[0]?.length || 0;

  return (
    <div
      className="grid"
      style={{ '--rows': gridRows, '--cols': gridCols } as React.CSSProperties}
    >
      {grid.flat().map((square, i) => {
        const row = Math.floor(i / gridCols);
        const col = i % gridCols;
        const coord = { x: col, y: row };
        const isSelected = selectedTile
          ? selectedTile.x === coord.x && selectedTile.y === coord.y
          : false;
        const visible = isSquareVisible(
          coord,
          visibleSquares,
          currentPlayerIndex,
        );
        const showMountain = shouldShowMountain(square);

        return isPlayerSquare(square) ? (
          <PlayerSquareView
            key={i}
            square={square}
            coord={coord}
            isSelected={isSelected}
            onTileSelect={onTileSelect}
            isVisible={visible}
          >
            {square.type === PlayerSquareType.GENERAL && (
              <General
                square={square}
                coord={coord}
                isSelected={isSelected}
                onTileSelect={onTileSelect}
                isVisible={visible}
              />
            )}
            {square.type === PlayerSquareType.ARMY && (
              <ArmySquare
                square={square}
                coord={coord}
                isSelected={isSelected}
                onTileSelect={onTileSelect}
                isVisible={visible}
              />
            )}
            {square.type === PlayerSquareType.PLAYER_CITY && (
              <ArmySquare
                square={square}
                coord={coord}
                isSelected={isSelected}
                onTileSelect={onTileSelect}
                isVisible={visible}
              />
            )}
          </PlayerSquareView>
        ) : (
          <SquareView
            key={i}
            square={square}
            coord={coord}
            isSelected={isSelected}
            onTileSelect={onTileSelect}
            isVisible={visible}
            showMountain={showMountain}
          />
        );
      })}
    </div>
  );
}

export { GameBoard };
