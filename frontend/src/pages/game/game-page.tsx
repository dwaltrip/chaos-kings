import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router';

import type { GameWithPlayers } from '@common/types/games';
import type { Coord, Movement } from '@core/types';
import { userStore } from '@/stores/user-store';
import { loadGame as apiLoadGame, GameNotFoundError } from '@/pages/game/games-api';
import { GameChat } from '@/pages/game/game-chat/game-chat';
import { GameUI } from '@/game-ui/game-ui';
import { gameplayStore } from '@/pages/game/gameplay/gameplay-store';
import { GameplayWsHandler } from '@/pages/game/gameplay/gameplay-ws-handler';
import { getWebSocketService } from '@/services/websocket-service';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';

function GamePage() {
  const { gameId } = useParams();
  const user = userStore((state) => state.user);
  const [game, setGame] = useState<GameWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Gameplay state from store (avoid unstable object selector)
  const boardState = gameplayStore((state) => state.boardState);
  const selectedTile = gameplayStore((state) => state.selectedTile);
  const { actions } = gameplayStore.getState();

  useEffect(() => {
    if (gameId) {
      loadGame(gameId);
    }
  }, [gameId]);
  
  // Setup gameplay WebSocket integration
  useEffect(() => {
    const wsService = getWebSocketService();
    wsService.addMessageHandler(GAMEPLAY_DOMAIN, GameplayWsHandler);
    
    return () => {
      wsService.removeMessageHandler(GAMEPLAY_DOMAIN, GameplayWsHandler);
      actions.reset();
    };
  }, [actions]);
  
  // Input handlers for gameplay
  const handleTileSelect = (coord: Coord) => {
    actions.setSelectedTile(coord);
  };
  
  const handleMoveRequest = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    if (!selectedTile) {
      console.warn('Cannot move: no tile selected');
      return;
    }
    
    const wsService = getWebSocketService();
    wsService.send({
      domain: GAMEPLAY_DOMAIN,
      type: 'move-request',
      payload: {
        sourceCoord: selectedTile,
        direction: direction as Movement
      }
    });
  };
  
  const handleCancelMoves = () => {
    const wsService = getWebSocketService();
    wsService.send({
      domain: GAMEPLAY_DOMAIN,
      type: 'cancel-moves-request',
      payload: null
    });
  };

  const loadGame = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const game = await apiLoadGame(id);
      setGame(game);
    }
    catch (err) {
      if (err instanceof GameNotFoundError) {
        setError('Game not found');
      } else {
        setError('Failed to load game');
      }
      console.error('Error loading game:', err);
    } finally {
      setLoading(false);
    }
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
          <span><strong>Player:</strong> {user.username}</span>
          <span><strong>Status:</strong> {game.status}</span>
          <span><strong>Created:</strong> {new Date(game.created_at).toLocaleString()}</span>
          <span><strong>Updated:</strong> {new Date(game.updated_at).toLocaleString()}</span>
        </div>
      </header>

      <aside className="game-sidebar">
        <GameChat game={game} />
      </aside>

      <main className="game-main">
        {boardState ? (
          <GameUI 
            boardState={boardState}
            selectedTile={selectedTile}
            onTileSelect={handleTileSelect}
            onMoveRequest={handleMoveRequest}
            onCancelMoves={handleCancelMoves}
          />
        ) : (
          <GameUI 
            boardState={{
              grid: game.config?.startingGrid || [],
              size: { width: 10, height: 10 }
            }}
            selectedTile={null}
            onTileSelect={() => console.log('No live gameplay yet')}
            onMoveRequest={() => console.log('No live gameplay yet')}
            onCancelMoves={() => console.log('No live gameplay yet')}
          />
        )}
      </main>
    </div>
  );
}

export { GamePage };

