import type { GameWithPlayers } from '@common/types/games';
import { isEnded } from '@core/game';
import type { PlayerIndex, PlayerMapping } from '@core/types';

import type { User } from '@/services/user-service';
import { PlayerColors } from '@/pages/game/player-colors';
import { GameStatusInfo } from '@/pages/game/game-status-info';

interface GameHeaderProps {
  game: GameWithPlayers;
  user: User;
  // TODO: make playerMapping non-nullable
  playerMapping: PlayerMapping | null;
  winner: PlayerIndex | null;
}

function GameHeader({ game, user, playerMapping, winner }: GameHeaderProps) {
  const isGameEnded = isEnded(game);

  if (!playerMapping) {
    return <header className="game-header">Missing player mapping...</header>;
  }

  return (
    <header className="game-header">
      <div className="flex gap-6 text-sm items-center">
        <span className="font-bold">Game #{game.id}</span>
        <span>
          <strong>Player:</strong> {user.username}
        </span>
        <GameStatusInfo
          game={game}
          isGameEnded={isGameEnded}
          winner={winner}
          playerMapping={playerMapping}
        />
        <PlayerColors
          game={game}
          playerMapping={playerMapping}
          currentUserId={user.id}
        />
        <span>
          <strong>Created:</strong> {new Date(game.created_at).toLocaleString()}
        </span>
        <span>
          <strong>Updated:</strong> {new Date(game.updated_at).toLocaleString()}
        </span>
      </div>
    </header>
  );
}

export { GameHeader };
