import { getPlayerColor } from '@/utils/player-colors';
import { useGameplayStoreV2 } from '@/domains/gameplay/stores/gameplay-store-v2';

interface ArmyInfoRowProps {
  name: string;
  color: string;
  armyCount?: number;
  landCount?: number;
}

function ArmyInfoRow({ name, color, armyCount, landCount }: ArmyInfoRowProps) {
  return (
    <div className="grid grid-cols-3 items-center text-sm">
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full border border-gray-300"
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{name}</span>
      </div>
      <span className="text-right font-mono tabular-nums">
        {armyCount !== undefined ? armyCount : '-'}
      </span>
      <span className="text-right font-mono tabular-nums">
        {landCount !== undefined ? landCount : '-'}
      </span>
    </div>
  );
}

function GameplayArmyInfo() {
  const players = useGameplayStoreV2((state) => state.players);
  const playersByIndex = useGameplayStoreV2((state) => state.playersByIndex);
  const playerStats = useGameplayStoreV2((state) => state.playerStats);
  const currentPlayerIndex = useGameplayStoreV2((state) => state.currentPlayerIndex);

  if (!players.length || !playerStats.length) {
    return null;
  }

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white/80 p-3 shadow-sm">
      <div className="mb-2 grid grid-cols-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
        <span>Player</span>
        <span className="text-right">Army</span>
        <span className="text-right">Land</span>
      </div>
      <div className="space-y-2">
        {playerStats.map((stat) => {
          const player = playersByIndex.get(stat.playerIndex)!;
          const isCurrentPlayer = player.player_index === currentPlayerIndex;
          return (
            <ArmyInfoRow
              key={player.id}
              name={isCurrentPlayer ? 'You' : player.username}
              color={getPlayerColor(player.player_index)}
              armyCount={stat.armyCount}
              landCount={stat.landCount}
            />
          );
        })}
      </div>
    </div>
  );
}

export { GameplayArmyInfo };
