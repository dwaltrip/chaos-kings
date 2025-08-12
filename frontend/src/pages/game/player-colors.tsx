import type { GameWithPlayers } from '@common/types/games';

interface PlayerColorsProps {
  game: GameWithPlayers;
  playerMapping: { playerId: string; playerIndex: number }[] | null;
  currentUserId: number;
}

function playerIndexToColor(playerIndex: number): string {
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24'];
  return colors[playerIndex] || '#777';
}

function PlayerColors({ game, playerMapping, currentUserId }: PlayerColorsProps) {
  if (!game.players.length) {
    return null;
  }

  return (
    <div className="flex gap-3 items-center">
      <span className="font-medium">Players:</span>
      <div className="flex gap-2">
        {game.players.map((player) => {
          const mapping = playerMapping?.find(m => m.playerId === player.player_id.toString());
          const playerIndex = mapping?.playerIndex ?? player.player_index;
          const color = playerIndexToColor(playerIndex);
          const isCurrentUser = player.player_id === currentUserId;
          
          return (
            <div key={player.id} className="flex items-center gap-1">
              <div 
                className="w-3 h-3 rounded border border-gray-400"
                style={{ backgroundColor: color }}
                title={`Player ${playerIndex + 1}`}
              />
              <span className={`text-xs ${isCurrentUser ? 'font-bold' : ''}`}>
                {isCurrentUser ? 'You' : `Player ${player.player_id}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { PlayerColors };