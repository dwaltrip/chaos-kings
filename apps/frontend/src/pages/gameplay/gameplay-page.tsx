import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router';

import { GameId } from '@kernel/ids';
import { GameIdFromURLParam } from '@kernel/domains/game';

import { useWsConnectionStore } from '@/ws-lib';

import { userStore } from '@/domains/users/user-store';
import {
  gameplayPageStore,
  selectGame,
} from '@/domains/gameplay/stores/gameplay-page-store';
import { useGameplayStoreV2 } from '@/domains/gameplay/stores/gameplay-store-v2';
import { joinGameplay, leaveGameplay } from '@/domains/gameplay/actions';
import {
  loadGameplayPage,
  resetGameplayPage,
} from '@/domains/gameplay/actions/load-gameplay-page';

import { AppNav } from '@/ui-lib/components/app-nav';
import { GameChat } from '@/domains/chat/ui/game-chat';
import { GameplayArmyInfo } from '@/domains/gameplay/pages/gameplay/army-info';
import { TurnCounter } from '@/domains/gameplay/pages/gameplay/turn-counter';
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

  return (
    <>
      <AppNav />
      <GamePageContent gameId={GameIdFromURLParam(gameId)} />
    </>
  );
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
  const user = userStore((state) => state.data);
  const game = gameplayPageStore(selectGame);
  const countdownActive = gameplayPageStore((state) => state.countdownActive);
  const countdownSeconds = gameplayPageStore((state) => state.countdownSeconds);
  const winner = useGameplayStoreV2((state) => state.winner);
  const tick = useGameplayStoreV2((state) => state.tick);
  const loading = gameplayPageStore((state) => state.isLoading());
  const error = gameplayPageStore((state) => state.error);
  const isConnected = useWsConnectionStore((state) => state.isConnected);
  const isGameReady = gameplayPageStore.getState().isReady();

  // Load game on mount / gameId change
  useEffect(() => {
    void loadGameplayPage(gameId);
    return () => resetGameplayPage();
  }, [gameId]);

  // Join/leave gameplay room after game load succeeds.
  // TODO: We may miss early server updates before join.
  // Not a big deal for MVP, as we get the full state on the next tick.
  // Long term: request a snapshot or have server send one on join.
  useEffect(() => {
    let joined = false;
    if (isGameReady) {
      joinGameplay(gameId);
      joined = true;
    }
    return () => {
      if (joined) {
        leaveGameplay(gameId);
      }
    };
  }, [gameId, isGameReady]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!isConnected || loading) {
    return <MessageDisplay message="Loading game..." />;
  }
  if (error) {
    return <MessageDisplay header="Error" message={error.message} asError />;
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
        <TurnCounter tick={tick} timingConfig={game.config.timing} />
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
