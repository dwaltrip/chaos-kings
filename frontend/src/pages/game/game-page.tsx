import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router';

import type { GameWithPlayers, GetGameResponse } from '@common/types/games';
import { apiService } from '@/services/api-service';
import { userStore } from '@/stores/user-store';
import { GameChat } from '@/pages/game/game-chat/game-chat';
import { GameUI } from '@/game-ui/game-ui';

function GamePage() {
  const { gameId } = useParams();
  const user = userStore((state) => state.user);
  const [game, setGame] = useState<GameWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gameId) {
      loadGame(gameId);
    }
  }, [gameId]);

  const loadGame = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.get(`/api/games/${id}`);
      
      if (response.status === 404) {
        setError('Game not found');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to load game');
      }
      
      const data: GetGameResponse = await response.json();
      setGame(data.game);
    } catch (err) {
      setError('Failed to load game');
      console.error('Error loading game:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!gameId) {
    return (
      <div>
        <h1>Error</h1>
        <p>Invalid game room. Please check the URL.</p>
      </div>
    );
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
    <div>
      <h1 className="text-2xl font-bold mb-4">Game #{game.id}</h1>
      
      <div className="space-y-4">
        <div>
          <p><strong>Player:</strong> {user.username}</p>
          <p><strong>Status:</strong> {game.status}</p>
          <p><strong>Created:</strong> {new Date(game.created_at).toLocaleString()}</p>
          <p><strong>Last Updated:</strong> {new Date(game.updated_at).toLocaleString()}</p>
        </div>
        
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">Game State</h3>
          <pre className="text-sm">{JSON.stringify(game.game_state, null, 2)}</pre>
        </div>
      </div>

      <div className="mt-8">
        <GameUI game={game} />
      </div>

      <div className="mt-8">
        <GameChat game={game} />
      </div>
    </div>
  );
}

export { GamePage };
