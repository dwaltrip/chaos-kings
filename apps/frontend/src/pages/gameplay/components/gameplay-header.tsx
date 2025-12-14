import { isEnded } from '@core/game';
import type { PlayerIndex } from '@core/types';
import type { GameWithPlayers } from '@platform/domains/games/types';

import type { User } from '@/domains/users/user-service';
import { useGameplayStoreV2 } from '@/domains/gameplay/stores/gameplay-store-v2';
import { PlayerColors } from '@/pages/gameplay/components/player-colors';
import { GameStatusInfo } from '@/pages/gameplay/components/gameplay-status-info';

interface GameHeaderProps {
  game: GameWithPlayers;
  user: User;
  winner: PlayerIndex | null;
}

function GameHeader({ game, user, winner }: GameHeaderProps) {
  const players = useGameplayStoreV2((state) => state.players);
  const playersByIndex = useGameplayStoreV2((state) => state.playersByIndex);
  const currentPlayerIndex = useGameplayStoreV2((state) => state.currentPlayerIndex);
  const isGameEnded = isEnded(game);

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
          playersByIndex={playersByIndex}
        />
        <PlayerColors players={players} currentPlayerIndex={currentPlayerIndex} />
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
