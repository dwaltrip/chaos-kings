import { usePuzzleStore, selectUserStats } from '@/domains/puzzles/stores/puzzle-store';

function UserStats() {
  const userStats = usePuzzleStore(selectUserStats);

  if (!userStats) {
    return null;
  }

  const { averageScore, totalAttempts, currentStreak, bestStreak } = userStats;

  return (
    <div className="user-stats rounded border border-gray-600 bg-gray-800 p-4">
      <h3 className="mb-3 text-lg font-semibold text-white">Your Stats</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <StatItem label="Average Score" value={averageScore.toFixed(1)} />
        <StatItem label="Total Puzzles" value={totalAttempts.toString()} />
        <StatItem label="Current Streak" value={currentStreak.toString()} />
        <StatItem label="Best Streak" value={bestStreak.toString()} />
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: string;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-400">{label}</span>
      <span className="text-xl font-bold text-white">{value}</span>
    </div>
  );
}

export { UserStats };
