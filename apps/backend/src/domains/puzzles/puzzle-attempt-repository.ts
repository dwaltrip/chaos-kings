import { Selectable, Insertable, sql } from 'kysely';

import { BaseRepository } from '@/utils/base-repository';
import { PuzzleAttemptsTable } from '@/domains/puzzles/puzzle-attempt.db';

type PuzzleAttempt = Selectable<PuzzleAttemptsTable>;
type NewPuzzleAttempt = Insertable<PuzzleAttemptsTable>;

interface UserPuzzleStats {
  averageScore: number;
  totalAttempts: number;
  currentStreak: number;
  bestStreak: number;
}

const PERFECT_START_THRESHOLD = 25;

class PuzzleAttemptRepository extends BaseRepository {
  async create(attempt: NewPuzzleAttempt): Promise<PuzzleAttempt> {
    const result = await this.db
      .insertInto('puzzle_attempts')
      .values(attempt)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  async getUserAttempts(userId: number, limit: number = 50): Promise<PuzzleAttempt[]> {
    return this.db
      .selectFrom('puzzle_attempts')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();
  }

  async getUserStats(userId: number): Promise<UserPuzzleStats> {
    // Get basic stats (average and total)
    const basicStats = await this.db
      .selectFrom('puzzle_attempts')
      .select([
        sql<number>`avg(land_count)`.as('average_score'),
        sql<number>`count(*)`.as('total_attempts'),
      ])
      .where('user_id', '=', userId)
      .executeTakeFirst();

    // Get all attempts ordered by created_at to compute streaks
    const attempts = await this.db
      .selectFrom('puzzle_attempts')
      .select(['land_count', 'created_at'])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();

    // Compute streaks
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    for (const attempt of attempts) {
      const isPerfect = attempt.land_count >= PERFECT_START_THRESHOLD;

      if (isPerfect) {
        tempStreak++;
        if (tempStreak > bestStreak) {
          bestStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    }

    // Current streak is from most recent attempts
    for (const attempt of attempts) {
      if (attempt.land_count >= PERFECT_START_THRESHOLD) {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      averageScore: basicStats?.average_score ? Number(basicStats.average_score) : 0,
      totalAttempts: basicStats?.total_attempts ? Number(basicStats.total_attempts) : 0,
      currentStreak,
      bestStreak,
    };
  }
}

const puzzleAttemptRepository = new PuzzleAttemptRepository();

export type { PuzzleAttempt, NewPuzzleAttempt, UserPuzzleStats };
export { puzzleAttemptRepository };
