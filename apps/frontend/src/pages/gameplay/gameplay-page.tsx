import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router';

import { GameId } from '@kernel/ids';
import { GameIdFromURLParam } from '@kernel/domains/game';

import { useWsConnectionStore } from '@/ws-lib';
import { useAsyncLoader } from '@/hooks/use-async-loader';

import { userStore } from '@/domains/users/user-store';
import { gameMetadataStore } from '@/domains/gameplay/stores/game-metadata-store';
import { joinGameplay, leaveGameplay } from '@/domains/gameplay/actions';
import { loadGame } from '@/domains/gameplay/actions/load-game';
import { setupGameState } from '@/domains/gameplay/actions/setup-game-state';

import { GameChat } from '@/domains/chat/components/game-chat';
import { GameplayArmyInfo } from '@/domains/gameplay/pages/gameplay/army-info';
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

  return <GamePageContent gameId={GameIdFromURLParam(gameId)} />;
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

function GamePageContent({ gameId }: { gameId: GameId }) {
  const user = userStore((state) => state.user);
  const game = gameMetadataStore((state) => state.game);
  const countdownActive = gameMetadataStore((state) => state.countdownActive);
  const countdownSeconds = gameMetadataStore((state) => state.countdownSeconds);
  const winner = gameMetadataStore((state) => state.winner);
  const isConnected = useWsConnectionStore((state) => state.isConnected);

  // Load game data
  const {
    data: loadedGame,
    loading: isLoadingGame,
    error,
    execute: executeLoad,
  } = useAsyncLoader(loadGame);

  // Load game on mount
  useEffect(() => {
    if (!game && gameId && !isLoadingGame) {
      executeLoad(gameId);
    }
  }, [gameId, game, isLoadingGame, executeLoad]);

  // Set up game state in stores when loaded
  useEffect(() => {
    if (loadedGame) {
      setupGameState(loadedGame);
    }
  }, [loadedGame]);

  // Join/leave gameplay room - convert URL param (string) to GameId at I/O boundary
  useEffect(() => {
    joinGameplay(gameId);
    return () => leaveGameplay(gameId);
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
      <GameHeader game={game} user={user} winner={winner} />

      <aside className="game-sidebar">
        <GameplayArmyInfo />
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
