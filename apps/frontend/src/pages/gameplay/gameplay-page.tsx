import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router';
import { GameId } from '@kernel/ids';

import { useWsConnectionStore } from '@/ws-lib';
import { userStore } from '@/domains/users/user-store';
import {
  gameMetadataStore,
  useGameLoadingState,
} from '@/domains/gameplay/stores/game-metadata-store';
import { joinGameplay, leaveGameplay } from '@/domains/gameplay/actions';
import { joinGameChatRoom, leaveGameChatRoom } from '@/domains/chat/actions';
import { GameChat } from '@/domains/chat/components/game-chat';
import { GameHeader } from '@/pages/gameplay/components/gameplay-header';
import { GameplayMainContent } from '@/pages/gameplay/components/gameplay-main-content';

function GameplayPage() {
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

  const isConnected = useWsConnectionStore((state) => state.isConnected);

  useEffect(() => {
    if (!game && gameId && !isLoadingGame) {
      actions.loadGame(gameId);
    }
  }, [gameId, game, isLoadingGame, actions]);

  // Join gameplay and chat rooms when page loads
  useEffect(() => {
    const numericGameId = GameId(parseInt(gameId, 10));

    joinGameplay(numericGameId);
    joinGameChatRoom(numericGameId);

    return () => {
      leaveGameplay(numericGameId);
      leaveGameChatRoom(numericGameId);
    };
  }, [gameId]);

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
        <GameplayMainContent
          gameId={game.id}
          gameStatus={game.status}
          countdownActive={countdownActive}
          countdownSeconds={countdownSeconds}
        />
      </main>
    </div>
  );
}

export { GameplayPage };
