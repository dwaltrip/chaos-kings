import { useParams, Navigate } from 'react-router';
import { userStore } from '@/stores/user-store';

function GamePage() {
  const { gameId } = useParams();
  const user = userStore((state) => state.user);

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

  return (
    <div>
      <h1>Game Room</h1>
      <p>You are in game room {gameId} as {user.username}</p>
    </div>
  );
}

export { GamePage };