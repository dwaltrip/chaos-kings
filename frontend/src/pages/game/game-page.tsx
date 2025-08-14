import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router';

import { userStore } from '@/stores/user-store';
import { gameMetadataStore } from '@/stores/game-metadata-store';
import { GameChat } from '@/pages/game/game-chat/game-chat';
import { GameUI } from '@/game-ui/game-ui';
import { PlayerColors } from '@/pages/game/player-colors';

function GamePage() {
  const { gameId } = useParams();
  const user = userStore((state) => state.user);

  // Get all metadata from game metadata store
  const game = gameMetadataStore((state) => state.game);
  const loading = gameMetadataStore((state) => state.loading);
  const error = gameMetadataStore((state) => state.error);
  const isGameEnded = gameMetadataStore((state) => state.isGameEnded);
  const winner = gameMetadataStore((state) => state.winner);
  const endReason = gameMetadataStore((state) => state.endReason);
  const playerMapping = gameMetadataStore((state) => state.playerMapping);
  const { actions } = gameMetadataStore.getState();

  useEffect(() => {
    if (gameId) {
      actions.loadGame(gameId);
    }

    // Reset store when component unmounts or gameId changes
    return () => {
      actions.reset();
    };
  }, [gameId, actions]);

  const getGameStatus = () => {
    if (isGameEnded) {
      return 'COMPLETED';
    }
    return game?.status || 'UNKNOWN';
  };

  const getWinnerInfo = () => {
    if (!isGameEnded || winner === null || !playerMapping) {
      return null;
    }

    const winnerMapping = playerMapping.find((p) => p.playerIndex === winner);
    const winnerPlayer = winnerMapping
      ? game?.players.find(
          (p) => p.player_id.toString() === winnerMapping.playerId,
        )
      : null;

    return {
      playerName: winnerPlayer
        ? `Player ${winnerPlayer.player_id}`
        : `Player ${winner}`,
      reason: endReason,
    };
  };

  if (!user) {
    return <Navigate to="/" replace />;
  }
  if (loading) {
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
          <span>
            <strong>Status:</strong> {getGameStatus()}
          </span>
          {getWinnerInfo() && (
            <span>
              <strong>Winner:</strong> {getWinnerInfo()!.playerName} (
              {getWinnerInfo()!.reason})
            </span>
          )}
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
        <GameUI gameId={game?.id || null} />
      </main>
    </div>
  );
}

export { GamePage };
