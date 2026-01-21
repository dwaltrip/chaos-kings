import type { UserPuzzleStats } from './api-types';

// Service interface for puzzle operations called by tRPC router.
// Backend implements this interface with real database access.
interface PuzzleService {
  getUserStats(userId: number): Promise<UserPuzzleStats>;
}

export type { PuzzleService };
