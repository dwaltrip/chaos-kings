import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router';

import { userStore } from '@/stores/user-store';
import { gameMetadataStore } from '@/stores/game-metadata-store';
import { GameChat } from '@/pages/game/game-chat/game-chat';
import { PlayerColors } from '@/pages/game/player-colors';
import { GameStatusInfo } from '@/pages/game/game-status-info';
import { GameMainContent } from '@/pages/game/game-main-content';
// import { useGameplayWebSocket } from '@/game-ui/hooks/use-gameplay-websocket';
import { useWebsocket } from '@/hooks/use-websocket';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';
import { GameplayWsHandler } from '@/game-ui/store/gameplay-ws-handler';
import { roomNameForGameplay } from '@common/domains/game/utils';

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

function GamePageContent({ gameId }: { gameId: string }) {
  const user = userStore((state) => state.user);

  // Get all metadata from game metadata store
  const game = gameMetadataStore((state) => state.game);
  const loading = gameMetadataStore((state) => state.loading);
  const error = gameMetadataStore((state) => state.error);
  const countdownActive = gameMetadataStore((state) => state.countdownActive);
  const countdownSeconds = gameMetadataStore((state) => state.countdownSeconds);
  const isGameEnded = gameMetadataStore((state) => state.isGameEnded);
  const winner = gameMetadataStore((state) => state.winner);
  const endReason = gameMetadataStore((state) => state.endReason);
  const playerMapping = gameMetadataStore((state) => state.playerMapping);
  const { actions } = gameMetadataStore.getState();

  // Connect to gameplay WebSocket at page level so players join the gameplay room
  // immediately when page loads, even before GameUI renders. This ensures the
  // backend can send countdown messages to players who are waiting.
  // Ideally we'd keep WebSocket details contained in GameUI, but for now this
  // is the easiest solution to fix the countdown race condition.
  // useGameplayWebSocket(game ? game.id : null);
  const wsService = useWebsocket(
    GAMEPLAY_DOMAIN,
    GameplayWsHandler,
    roomNameForGameplay(gameId),
  );
  const isConnected = wsService.isConnected;

  useEffect(() => {
    if (gameId && !loading) {
      actions.loadGame(gameId);
    }
  }, [gameId, loading]);

  if (!user) {
    return <Navigate to="/" replace />;
  }
  if (!isConnected || loading) {
    return <div className="text-center">Loading game...</div>;
  }
  if (error) {
    return (
      <div className="text-center text-red-600">
        <h1>Error</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (!game) {
    return (
      <div className="text-center">
        <h1>Game Not Found</h1>
        <p>The game you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="game-page game-layout">
      <header className="game-header">
        <div className="flex gap-6 text-sm items-center">
          <span className="font-bold">Game #{game.id}</span>
          <span>
            <strong>Player:</strong> {user.username}
          </span>
          <GameStatusInfo
            game={game}
            isGameEnded={isGameEnded}
            winner={winner}
            endReason={endReason}
            playerMapping={playerMapping}
          />
          <PlayerColors
            game={game}
            playerMapping={playerMapping}
            currentUserId={user.id}
          />
          <span>
            <strong>Created:</strong>{' '}
            {new Date(game.created_at).toLocaleString()}
          </span>
          <span>
            <strong>Updated:</strong>{' '}
            {new Date(game.updated_at).toLocaleString()}
          </span>
        </div>
      </header>

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
