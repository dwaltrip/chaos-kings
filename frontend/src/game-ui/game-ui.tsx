import clsx from 'clsx';
import { type Coord } from '@core/types';
import { useKeyboardControls } from '@/game-ui/hooks/use-keyboard-controls';
import {
  useBoardState,
  useGameplayState,
} from '@/game-ui/hooks/use-gameplay-state';
import { useFogOfWar } from '@/game-ui/hooks/use-fog-of-war';
import { useGameplay } from '@/game-ui/hooks/use-gameplay';
import { useCurrentPlayerIndex } from '@/stores/game-metadata-store';
import { GameBoard } from '@/game-ui/components/game-board';

import '@/game-ui/game-ui.css';

interface GameUIProps {
  gameId: number | null;
}

// -------------------------------------------------------------
// TODO: clean up where all of the state is coming from
// separate UI state (selected Tile, etc) from core game state
// -------------------------------------------------------------
function GameUI({ gameId }: GameUIProps) {
  // Internal state management
  const gameplayState = useGameplayState(gameId);
  const boardState = useBoardState();

  const currentPlayerIndex = useCurrentPlayerIndex();
  const fogOfWarResult = useFogOfWar({ boardState, currentPlayerIndex });
  const gameplayActions = useGameplay();

  // Derived state
  const selectedTile = gameplayState.selectedTile;
  const game = gameplayState.game;
  const disabled = gameplayState.gameEnded;
  const visibleSquares = fogOfWarResult.visibleSquares;

  const handleMoveRequest = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') =>
    gameplayActions.handleMoveRequest(direction, selectedTile);

  const handleCancelMoves = () => gameplayActions.handleCancelMoves();

  const handleTileSelect = (coord: Coord) => {
    if (disabled) return;
    gameplayActions.handleTileSelect(coord);
  };

  useKeyboardControls({
    onMoveRequest: handleMoveRequest,
    onCancelMoves: handleCancelMoves,
    disabled,
  });

  const shouldShowGameBoard = boardState && game && currentPlayerIndex !== null;
  if (!shouldShowGameBoard) {
    console.log('[DEBUG GameUI] Not showing game board', {
      boardState,
      game,
      currentPlayerIndex,
    });
  }

  return (
    <div className={clsx(disabled && 'game-ui-disabled')}>
      {shouldShowGameBoard ? (
        <GameBoard
          game={game}
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

export { GameUI };
