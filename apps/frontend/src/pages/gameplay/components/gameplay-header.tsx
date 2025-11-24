import { isEnded } from '@core/game';
import type { PlayerIndex, PlayerMapping } from '@core/types';
import type { GameWithPlayers } from '@platform/domains/games/types';

import type { User } from '@/domains/users/user-service';
import { PlayerColors } from '@/pages/gameplay/components/player-colors';
import { GameStatusInfo } from '@/pages/gameplay/components/gameplay-status-info';

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
    return <header className="gameplay-header">Missing player mapping...</header>;
  }

  return (
    <header className="gameplay-header">
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
        <PlayerColors game={game} playerMapping={playerMapping} currentUserId={user.id} />
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
