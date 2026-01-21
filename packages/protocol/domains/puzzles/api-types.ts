// API types for puzzle REST endpoints

interface UserPuzzleStats {
  averageScore: number;
  totalAttempts: number;
  currentStreak: number;
  bestStreak: number;
}

// GET /api/puzzles/stats
type GetUserPuzzleStatsResponse = UserPuzzleStats;

export type { UserPuzzleStats, GetUserPuzzleStatsResponse };
