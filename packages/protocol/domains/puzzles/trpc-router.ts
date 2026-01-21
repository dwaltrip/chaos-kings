import type { UserPuzzleStats } from './api-types';

import { router, protectedProcedure } from '@protocol/trpc/trpc';

const puzzleRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }): Promise<UserPuzzleStats> => {
    return ctx.services.puzzle.getUserStats(ctx.user.id);
  }),
});

export { puzzleRouter };
