import { Selectable, Insertable, sql } from 'kysely';

import { BaseRepository } from '@/utils/base-repository';
import { PuzzleAttemptsTable } from '@/domains/puzzles/puzzle-attempt.db';

type PuzzleAttempt = Selectable<PuzzleAttemptsTable>;
type NewPuzzleAttempt = Insertable<PuzzleAttemptsTable>;

interface BasicStats {
  averageScore: number;
  totalAttempts: number;
}

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

  async getBasicStats(userId: number): Promise<BasicStats> {
    const result = await this.db
      .selectFrom('puzzle_attempts')
      .select([
        sql<number>`avg(land_count)`.as('average_score'),
        sql<number>`count(*)`.as('total_attempts'),
      ])
      .where('user_id', '=', userId)
      .executeTakeFirst();

    return {
      averageScore: result?.average_score ? Number(result.average_score) : 0,
      totalAttempts: result?.total_attempts ? Number(result.total_attempts) : 0,
    };
  }
}

const puzzleAttemptRepository = new PuzzleAttemptRepository();

export type { PuzzleAttempt, NewPuzzleAttempt, BasicStats };
export { puzzleAttemptRepository };
