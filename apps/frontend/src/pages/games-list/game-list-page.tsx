import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

import type { GameWithPlayers } from '@platform/domains/games/types';
import { apiService } from '@/services/api-service';

import { AppNav } from '@/domains/ui-lib/app-nav';
import { GameListPlayerInfo } from '@/pages/games-list/game-list-player-info';

// TODO: Is this a useful interface? think about where to put stuff like this
// Feels analogous to the WS types in @protocol
interface ListGamesResponse {
  games: GameWithPlayers[];
}

function GameListPage() {
  return (
    <>
      <AppNav />
      <GameListPageContent />
    </>
  );
}

// TODO: layout on this page is a bit messed up. it's overflowing / not scrolling
function GameListPageContent() {
  const [games, setGames] = useState<GameWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // TODO: make sure this only runs once
    loadGames();
  }, []);

  const loadGames = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/api/games');
      if (!response.ok) {
        throw new Error('Failed to load games');
      }
      const data: ListGamesResponse = await response.json();
      setGames(data.games);
    } catch (err) {
      setError('Failed to load games');
      console.error('Error loading games:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center">Loading games...</div>;
  }

  if (error) {
    return (
      <div className="text-center text-red-600">
        <p>{error}</p>
        <button
          onClick={loadGames}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="game-list-page">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Games</h1>
        <p className="text-sm text-gray-600">
          Games are created through matchmaking. Visit the Join Game page to find a match!
        </p>
      </div>

      {!games || games.length === 0 ? (
        <p className="text-gray-600">
          No games yet. Join the matchmaking queue to start playing!
        </p>
      ) : (
        <div className="games-list space-y-4">
          {games.map((game) => (
            <div
              key={game.id}
              onClick={() => navigate(`/games/${game.id}`)}
              className="p-4 border border-gray-300 rounded cursor-pointer hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">Game #{game.id}</h3>
                  <p className="text-sm text-gray-600">Status: {game.status}</p>
                  <GameListPlayerInfo players={game.players} />
                </div>
                <div className="text-sm text-gray-500">
                  <p>Created: {new Date(game.created_at).toLocaleString()}</p>
                  <p>Updated: {new Date(game.updated_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { GameListPage };
