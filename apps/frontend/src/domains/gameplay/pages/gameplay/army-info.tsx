import type { PlayerStats } from '@platform/domains/gameplay/types';

import { getPlayerColor } from '@/utils/player-colors';
import { userStore } from '@/domains/users/user-store';
import { gameMetadataStore } from '@/domains/gameplay/stores/game-metadata-store';
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

interface PlayerRow {
  key: string;
  name: string;
  color: string;
  stats?: PlayerStats;
}

function buildPlayerRows(
  playerMapping: { playerId: string; playerIndex: number }[],
  playerStats: PlayerStats[],
  game: ReturnType<typeof gameMetadataStore.getState>['game'],
  currentUser: ReturnType<typeof userStore.getState>['user'],
): PlayerRow[] {
  return playerMapping.map((mapping) => {
    const player = game?.players.find(
      (p) => p.user_id === Number.parseInt(mapping.playerId, 10),
    );
    const playerUsername =
      player &&
      'username' in player &&
      typeof (player as { username?: string }).username === 'string'
        ? (player as { username?: string }).username
        : undefined;
    const name =
      playerUsername ||
      (player?.user_id === currentUser?.id ? currentUser?.username : undefined) ||
      `Player ${mapping.playerIndex + 1}`;
    const stats = playerStats[mapping.playerIndex];

    return {
      key: `${mapping.playerIndex}-${mapping.playerId}`,
      name,
      color: getPlayerColor(mapping.playerIndex),
      stats,
    };
  });
}

function GameplayArmyInfo() {
  const playerStats = useGameplayStoreV2((state) => state.playerStats);
  const game = gameMetadataStore((state) => state.game);
  const playerMapping = gameMetadataStore((state) => state.playerMapping);
  const currentUser = userStore((state) => state.user);

  if (!game || !playerMapping) {
    return null;
  }

  if (!playerStats.length) {
    return (
      <div className="mb-4 rounded border border-gray-200 bg-white/80 p-3 shadow-sm text-sm text-gray-500">
        Stats missing...
      </div>
    );
  }

  const rows = buildPlayerRows(playerMapping, playerStats, game, currentUser);

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white/80 p-3 shadow-sm">
      <div className="mb-2 grid grid-cols-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
        <span>Player</span>
        <span className="text-right">Army</span>
        <span className="text-right">Land</span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <ArmyInfoRow
            key={row.key}
            name={row.name}
            color={row.color}
            armyCount={row.stats?.armyCount}
            landCount={row.stats?.landCount}
          />
        ))}
      </div>
    </div>
  );
}

export { GameplayArmyInfo };
