import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { apiService } from '@/services/api-service';
import type { Game, ListGamesResponse, CreateGameResponse } from '@common/types/games';

function GameListPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
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

  const createGame = async () => {
    try {
      setCreating(true);
      const response = await apiService.post('/api/games');
      if (!response.ok) {
        throw new Error('Failed to create game');
      }
      const data: CreateGameResponse = await response.json();
      setGames(prev => [data.game, ...prev]);
      navigate(`/games/${data.game.id}`);
    } catch (err) {
      setError('Failed to create game');
      console.error('Error creating game:', err);
    } finally {
      setCreating(false);
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Games</h1>
        <button 
          onClick={createGame}
          disabled={creating}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Game'}
        </button>
      </div>

      {!games || games.length === 0 ? (
        <p className="text-gray-600">No games yet. Create your first game!</p>
      ) : (
        <div className="space-y-4">
          {games.map(game => (
            <div 
              key={game.id}
              onClick={() => navigate(`/games/${game.id}`)}
              className="p-4 border border-gray-300 rounded cursor-pointer hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">Game #{game.id}</h3>
                  <p className="text-sm text-gray-600">Status: {game.status}</p>
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
