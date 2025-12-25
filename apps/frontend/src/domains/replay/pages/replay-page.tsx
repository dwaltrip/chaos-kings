import { useEffect } from 'react';
import { useParams, Link } from 'react-router';

import { GameId } from '@kernel/ids';
import { GameIdFromURLParam } from '@kernel/domains/game';

import { useReplayStore, replayActions } from '@/domains/replay/stores/replay-store';
import { loadReplay } from '@/domains/replay/actions';
import { ReplayBoard } from '@/domains/replay/pages/replay-board';
import { ReplayControls } from '@/domains/replay/pages/replay-controls';
import { AppNav } from '@/domains/ui-lib/app-nav';

function ReplayPage() {
  const { gameId } = useParams();

  if (!gameId) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Replay Not Found</h1>
        <p>No game ID provided.</p>
        <Link to="/" className="text-blue-400 hover:underline">
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <>
      <AppNav></AppNav>
      <ReplayPageContent gameId={GameIdFromURLParam(gameId)} />
    </>
  );
}

function ReplayPageContent({ gameId }: { gameId: GameId }) {
  const loading = useReplayStore((state) => state.loading);
  const error = useReplayStore((state) => state.error);
  const currentFrame = useReplayStore((state) => state.currentFrame);
  const players = useReplayStore((state) => state.players);
  const winner = useReplayStore((state) => state.currentFrame?.winner);
  const gameEnded = useReplayStore((state) => state.currentFrame?.gameEnded ?? false);

  useEffect(() => {
    loadReplay(gameId);

    return () => {
      replayActions().reset();
    };
  }, [gameId]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p>Loading replay...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-500">Error</h1>
        <p className="mb-4">{error}</p>
        <Link to="/" className="text-blue-400 hover:underline">
          Go Home
        </Link>
      </div>
    );
  }

  if (!currentFrame) {
    return (
      <div className="p-8 text-center">
        <p>No replay data available.</p>
      </div>
    );
  }

  const winnerPlayer =
    winner !== undefined ? players.find((p) => p.playerIndex === winner) : null;

  return (
    <div className="replay-page flex flex-col h-screen bg-gray-900 text-white">
      <header className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Replay - Game #{gameId}</h1>
            <div className="text-sm text-gray-400">
              Players:{' '}
              {players
                .map((p) => p.username || `Player ${p.playerIndex + 1}`)
                .join(' vs ')}
            </div>
          </div>
          {gameEnded && winnerPlayer && (
            <div className="text-green-400 font-bold">
              Winner: {winnerPlayer.username || `Player ${winnerPlayer.playerIndex + 1}`}
            </div>
          )}
          <Link to="/" className="text-blue-400 hover:underline">
            Home
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <ReplayBoard boardState={currentFrame.board} />
      </main>

      <footer className="p-4 border-t border-gray-700">
        <ReplayControls />
      </footer>
    </div>
  );
}

export { ReplayPage };
