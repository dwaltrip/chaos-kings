import type { UserPuzzleStats } from '@protocol/domains/puzzles/api-types';

import { puzzleAttemptRepository } from '../puzzle-attempt-repository';

const PERFECT_START_THRESHOLD = 25;

async function getUserStats(userId: number): Promise<UserPuzzleStats> {
  const basicStats = await puzzleAttemptRepository.getBasicStats(userId);
  const attempts = await puzzleAttemptRepository.getUserAttempts(userId);

  const { currentStreak, bestStreak } = computeStreaks(attempts.map((a) => a.land_count));

  return {
    ...basicStats,
    currentStreak,
    bestStreak,
  };
}

function computeStreaks(landCounts: number[]): {
  currentStreak: number;
  bestStreak: number;
} {
  let bestStreak = 0;
  let tempStreak = 0;

  // landCounts are ordered most recent first
  for (const landCount of landCounts) {
    if (landCount >= PERFECT_START_THRESHOLD) {
      tempStreak++;
      if (tempStreak > bestStreak) {
        bestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  // Current streak is from most recent attempts
  let currentStreak = 0;
  for (const landCount of landCounts) {
    if (landCount >= PERFECT_START_THRESHOLD) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, bestStreak };
}

export { getUserStats };
