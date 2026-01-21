import { router } from './trpc';
import { puzzleRouter } from '@protocol/domains/puzzles/trpc-router';

const appRouter = router({
  puzzle: puzzleRouter,
});

type AppRouter = typeof appRouter;

export type { AppRouter };
export { appRouter };
