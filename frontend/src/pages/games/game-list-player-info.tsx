import type { Player } from '@common/types/player';
import { getPlayerDisplayInfo } from '@/utils/player-colors';

interface GameListPlayerInfoProps {
  players: (Player & { username?: string })[];
}

function GameListPlayerInfo({ players }: GameListPlayerInfoProps) {
  if (!players || players.length === 0) {
    return null;
  }

  return (
    <div className="mt-2">
      <p className="text-xs text-gray-500 mb-1">Players:</p>
      <div className="flex flex-wrap gap-2">
        {players.map((player) => {
          const playerInfo = getPlayerDisplayInfo(player);
          return (
            <div key={player.id} className="flex items-center gap-1 text-xs">
              <div 
                className="w-3 h-3 rounded border border-gray-400"
                style={{ backgroundColor: playerInfo.color }}
                title={`Player ${playerInfo.playerIndex + 1}`}
              />
              <span className="text-gray-700">
                {playerInfo.username || `User ${playerInfo.playerId}`} (ID: {playerInfo.playerId})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { GameListPlayerInfo };