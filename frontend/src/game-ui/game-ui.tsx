import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';
import clsx from 'clsx';

import {
  SquareType,
  type Square,
  type PlayerSquare,
  PlayerSquareType,
  type BoardState,
  type Coord,
} from '@core/types';
import { isPlayerSquare } from '@core/square';
import { useKeyboardControls } from '@/game-ui/hooks/use-keyboard-controls';
import {
  isSquareVisible,
  shouldShowMountain,
} from '@/game-ui/utils/visibility-utils';
import { useGameplayState } from '@/game-ui/hooks/use-gameplay-state';
import { useFogOfWar } from '@/game-ui/hooks/use-fog-of-war';
import { useGameplay } from '@/game-ui/hooks/use-gameplay';
import { useGameplayWebSocket } from '@/game-ui/hooks/use-gameplay-websocket';
import { userStore } from '@/stores/user-store';

import '@/game-ui/game-ui.css';

interface GameUIProps {
  gameId: number | null;
}

function GameUI({ gameId }: GameUIProps) {
  const user = userStore((state) => state.user);

  // Internal state management
  const gameplayState = useGameplayState(gameId);

  // WebSocket connection management
  useGameplayWebSocket(gameId);
  const fogOfWarResult = useFogOfWar({
    boardState: gameplayState.boardState,
    playerMapping: gameplayState.playerMapping,
    user,
    gameId,
  });
  const gameplayActions = useGameplay();

  // Derived state
  const boardState = gameplayState.boardState;
  const selectedTile = gameplayState.selectedTile;
  const disabled = gameplayState.gameEnded;
  const currentPlayerIndex = fogOfWarResult.currentPlayerIndex;
  const visibleSquares = fogOfWarResult.visibleSquares;

  const onMoveRequest = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') =>
    gameplayActions.handleMoveRequest(direction, selectedTile);

  useKeyboardControls({
    onMoveRequest,
    onCancelMoves: gameplayActions.handleCancelMoves,
    disabled,
  });

  const handleTileSelect = (coord: Coord) => {
    if (disabled) return;
    gameplayActions.handleTileSelect(coord);
  };

  return (
    <div className={disabled ? 'game-ui-disabled' : ''}>
      {boardState ? (
        <GameBoard
          boardState={boardState}
          selectedTile={selectedTile}
          onTileSelect={handleTileSelect}
          currentPlayerIndex={currentPlayerIndex}
          visibleSquares={visibleSquares}
        />
      ) : (
        <div>Loading game...</div>
      )}
    </div>
  );
}

function playerIndexToColor(playerIndex: number): string {
  // Simple color mapping for now - could be made configurable
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24'];
  return colors[playerIndex] || '#777';
}

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
          />
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

function ArmyCount({ count }: { count: number }) {
  return <span className="army-count">{count}</span>;
}

type PlayerSquareProps = {
  square: PlayerSquare;
  coord: Coord;
  isSelected: boolean;
  onTileSelect: (coord: Coord) => void;
  isVisible: boolean;
};

function General({
  square,
  coord,
  isSelected,
  onTileSelect,
  isVisible,
}: PlayerSquareProps) {
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

function ArmySquare({
  square,
  coord,
  isSelected,
  onTileSelect,
  isVisible,
}: PlayerSquareProps) {
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

function SquareView({
  square,
  coord,
  isSelected,
  onTileSelect,
  isVisible,
  showMountain,
}: {
  square: Square;
  coord: Coord;
  isSelected: boolean;
  onTileSelect: (coord: Coord) => void;
  isVisible: boolean;
  showMountain: boolean;
}) {
  const className = clsx(
    'cell',
    square && square.type.toString().toLowerCase(),
    isSelected && 'selected',
    !isVisible && 'fog-of-war',
  );

  const handleClick = () => {
    console.log(`[DEBUG_TILE_SELECT] Clicked tile at (${coord.x}, ${coord.y})`);
    onTileSelect(coord);
  };

  if (!square) {
    throw new Error('Square is null');
  }
  return (
    <div className={className} onClick={handleClick}>
      {(isVisible || showMountain) && square.type === SquareType.MOUNTAIN && (
        <img src={mountainIcon} />
      )}
    </div>
  );
}

function PlayerSquareView({
  square,
  coord,
  isSelected,
  onTileSelect,
  isVisible,
}: PlayerSquareProps) {
  const fogClass = !isVisible ? 'fog-of-war' : '';
  const className = `cell ${square && square.type.toString().toLowerCase()} ${fogClass}`;
  if (!square) {
    throw new Error('Square is null');
  }
  return (
    <div className={className}>
      {isVisible && square.type === PlayerSquareType.GENERAL && (
        <General
          square={square}
          coord={coord}
          isSelected={isSelected}
          onTileSelect={onTileSelect}
          isVisible={isVisible}
        />
      )}
      {isVisible && square.type === PlayerSquareType.ARMY && (
        <ArmySquare
          square={square}
          coord={coord}
          isSelected={isSelected}
          onTileSelect={onTileSelect}
          isVisible={isVisible}
        />
      )}
      {/* TODO: Implement view for PLAYER_CITY */}
      {isVisible && square.type === PlayerSquareType.PLAYER_CITY && (
        <ArmySquare
          square={square}
          coord={coord}
          isSelected={isSelected}
          onTileSelect={onTileSelect}
          isVisible={isVisible}
        />
      )}
    </div>
  );
}

// ---------------------------------------
// TODO: consolidate with PlayerSquareView
// ---------------------------------------
function PlayerSquareLayout({
  playerIndex,
  children,
  className,
  isSelected,
  onClick,
  isVisible,
}: {
  playerIndex: number;
  children: any;
  className?: string;
  isSelected: boolean;
  onClick: () => void;
  isVisible: boolean;
}) {
  const colorStyle = { backgroundColor: playerIndexToColor(playerIndex) };
  const selectedClass = isSelected ? 'selected' : '';
  const visibilityClass = !isVisible ? 'fog-of-war' : '';

  const handleClick = () => {
    console.log(
      `[DEBUG_TILE_SELECT] Clicked player square, isSelected: ${isSelected}`,
    );
    onClick();
  };

  return (
    <div
      className={`player-square ${className || ''} ${selectedClass} ${visibilityClass}`}
      style={colorStyle}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}

export { GameUI };
