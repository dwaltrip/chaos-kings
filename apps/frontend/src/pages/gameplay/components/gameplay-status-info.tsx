import type { GameWithPlayers, Player } from '@platform/domains/games/types';
import type { PlayerIndex } from '@core/types';

interface GameStatusInfoProps {
  game: GameWithPlayers;
  isGameEnded: boolean;
  winner: PlayerIndex | null;
  playersByIndex: Map<PlayerIndex, Player>;
}

function GameStatusInfo({
  game,
  isGameEnded,
  winner,
  playersByIndex,
}: GameStatusInfoProps) {
  const winnerPlayer = winner !== null ? playersByIndex.get(winner) : null;

  return (
    <>
      <span>
        <strong>Status:</strong> {isGameEnded ? 'COMPLETED' : game.status}
      </span>
      {winnerPlayer && (
        <span>
          <strong>Winner:</strong> {winnerPlayer.username}
        </span>
      )}
    </>
  );
}

export { GameStatusInfo };
export type { GameStatusInfoProps };
