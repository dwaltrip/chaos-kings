import type { UserPuzzleStats } from '@protocol/domains/puzzles/api-types';

import { trpc } from '@/services/trpc-client';

// TODO: Add error handling utilities (defer for now - tRPC errors have different shape)
async function fetchUserStats(): Promise<UserPuzzleStats> {
  return trpc.puzzle.getStats.query();
}

export { fetchUserStats };
