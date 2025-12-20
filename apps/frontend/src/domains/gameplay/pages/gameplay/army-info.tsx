import { getPlayerColor } from '@/utils/player-colors';
import { useGameplayStoreV2 } from '@/domains/gameplay/stores/gameplay-store-v2';

import './army-info.css';

interface ArmyInfoRowProps {
  name: string;
  color: string;
  armyCount?: number;
  landCount?: number;
}

function ArmyInfoRow({ name, color, armyCount, landCount }: ArmyInfoRowProps) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <span
          className="player-color-bubble h-3 w-3 rounded-full border border-gray-300 "
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{name}</span>
      </div>
      <span className="text-right font-mono tabular-nums text-sm">
        {armyCount !== undefined ? armyCount : '-'}
      </span>
      <span className="text-right font-mono tabular-nums text-sm">
        {landCount !== undefined ? landCount : '-'}
      </span>
    </>
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
      <div className="army-info-grid items-center gap-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Player
        </span>
        <span className="text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
          Army
        </span>
        <span className="text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
          Land
        </span>
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
