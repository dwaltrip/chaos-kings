import { useParams, Navigate } from 'react-router';
import { usernameStore } from '@/stores/username-store';

export function GamePage() {
  const { gameId } = useParams();
  const username = usernameStore((state) => state.username);

  if (!username) {
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

  return (
    <div>
      <h1>Game Room</h1>
      <p>You are in game room {gameId} as {username}</p>
    </div>
  );
}