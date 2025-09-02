import { useKeyboardControls } from '@/game-ui/hooks/use-keyboard-controls';
import {
  useBoardState,
  useGameplayState,
} from '@/game-ui/hooks/use-gameplay-state';
import { useGameplay } from '@/game-ui/hooks/use-gameplay';
import { useCurrentPlayerIndex } from '@/stores/game-metadata-store';
import { GameBoard } from '@/game-ui/components/game-board';

import '@/game-ui/game-page.css';
import '@/game-ui/game-tile.css';
import {
  useGameplayStoreV2,
  useSelectedTile,
} from '@/game-ui/store/gameplay-store-v2';

interface GameUIProps {
  gameId: number | null;
}
function GameUI({ gameId }: GameUIProps) {
  // Internal state management
  const gameplayState = useGameplayState();
  const boardState = useBoardState();
  const currentPlayerIndex = useCurrentPlayerIndex();
  const gameplayActions = useGameplay();

  // Derived state
  const selectedTile = useGameplayStoreV2(useSelectedTile);
  const game = gameplayState.game;
  const disabled = gameplayState.gameEnded;

  const handleMoveRequest = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') =>
    gameplayActions.handleMoveRequest(direction, selectedTile);

  const handleCancelMoves = () => gameplayActions.handleCancelMoves();

  useKeyboardControls({
    onMoveRequest: handleMoveRequest,
    onCancelMoves: handleCancelMoves,
    disabled,
  });

  // const shouldShowGameBoard = boardState && game && currentPlayerIndex !== null;
  const shouldShowGameBoard = boardState && game;
  if (!shouldShowGameBoard) {
    console.log('[DEBUG GameUI] Not showing game board', {
      boardState,
      game,
      currentPlayerIndex,
    });
  }

  if (!shouldShowGameBoard) {
    return <div>Loading game...</div>;
  }

  return <GameBoard boardState={boardState} disabled={disabled} />;
}

export { GameUI };
