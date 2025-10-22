import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router';

import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';
import { bareRoomForGameplay } from '@common/domains/game/utils';

import { useWebsocket } from '@/hooks/use-websocket';
import { userStore } from '@/stores/user-store';
import { gameMetadataStore, useGameLoadingState } from '@/stores/game-metadata-store';
import { GameplayWsHandler } from '@/game-ui/store/gameplay-ws-handler';

import { GameHeader } from '@/pages/game/components/game-header';
import { GameChat } from '@/pages/game/game-chat/game-chat';
import { GameMainContent } from '@/pages/game/game-main-content';

function GamePage() {
  const { gameId } = useParams();

  if (!gameId) {
    return (
      <div>
        <h1>Game Not Found</h1>
        <p>The game you're looking for doesn't exist.</p>
      </div>
    );
  }

  return <GamePageContent gameId={gameId} />;
}

function MessageDisplay({
  header = null,
  message,
  asError,
}: {
  header?: string | null;
  message: string;
  asError?: boolean;
}) {
  return (
    <div className={`text-center ${asError ? 'text-red-600' : ''}`}>
      {header && <h1>{header}</h1>}
      <p>{message}</p>
    </div>
  );
}

function GamePageContent({ gameId }: { gameId: string }) {
  const user = userStore((state) => state.user);

  // Get critical game loading state with proper selector
  const { game, loading: isLoadingGame, error } = useGameLoadingState();

  const countdownActive = gameMetadataStore((state) => state.countdownActive);
  const countdownSeconds = gameMetadataStore((state) => state.countdownSeconds);
  const winner = gameMetadataStore((state) => state.winner);
  const playerMapping = gameMetadataStore((state) => state.playerMapping);
  const { actions } = gameMetadataStore.getState();

  // Connect to gameplay WebSocket at page level so players join the gameplay room
  // immediately when page loads, even before GameUI renders. This ensures the
  // backend can send countdown messages to players who are waiting.
  // Ideally we'd keep WebSocket details contained in GameUI, but for now this
  // is the easiest solution to fix the countdown race condition.
  // useGameplayWebSocket(game ? game.id : null);
  const roomBare = bareRoomForGameplay(gameId);
  const wsService = useWebsocket(GAMEPLAY_DOMAIN, GameplayWsHandler, roomBare);
  const isConnected = wsService.isConnected;

  useEffect(() => {
    if (!game && gameId && !isLoadingGame) {
      actions.loadGame(gameId);
    }
  }, [gameId, game, isLoadingGame, actions]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!isConnected || isLoadingGame) {
    return <MessageDisplay message="Loading game..." />;
  }
  if (error) {
    return <MessageDisplay header="Error" message={error} asError />;
  }
  if (!game) {
    return (
      <MessageDisplay
        header="Game Not Found"
        message="The game you're looking for doesn't exist."
      />
    );
  }

  return (
    <div className="game-page game-layout">
      <GameHeader game={game} user={user} playerMapping={playerMapping} winner={winner} />

      <aside className="game-sidebar">
        <GameChat game={game} />
      </aside>

      <main className="game-main">
        <GameMainContent
          gameId={game.id}
          gameStatus={game.status}
          countdownActive={countdownActive}
          countdownSeconds={countdownSeconds}
        />
      </main>
    </div>
  );
}

export { GamePage };
