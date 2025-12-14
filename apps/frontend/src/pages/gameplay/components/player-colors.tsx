import type { Player } from '@platform/domains/games/types';
import type { PlayerIndex } from '@core/types';

import { getPlayerColor } from '@/utils/player-colors';

interface PlayerColorsProps {
  players: Player[];
  currentPlayerIndex: PlayerIndex | null;
}

function PlayerColors({ players, currentPlayerIndex }: PlayerColorsProps) {
  if (!players.length) return null;

  return (
    <div className="flex gap-3 items-center">
      <span className="font-medium">Players:</span>
      <div className="flex gap-2">
        {players.map((player) => {
          const isCurrentPlayer = player.player_index === currentPlayerIndex;
          return (
            <div key={player.id} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded border border-gray-400"
                style={{ backgroundColor: getPlayerColor(player.player_index) }}
              />
              <span className={`text-xs ${isCurrentPlayer ? 'font-bold' : ''}`}>
                {isCurrentPlayer ? 'You' : player.username}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { PlayerColors };
