import { initTRPC, TRPCError } from '@trpc/server';

import type { PuzzleService } from '@protocol/domains/puzzles/service';

// Service interfaces that backend must implement
interface Services {
  puzzle: PuzzleService;
}

// Context passed to all tRPC procedures
// Backend provides runInTransaction to wrap DB operations in AsyncLocalStorage context
interface TRPCContext {
  user: { id: number; username: string } | null;
  services: Services;
  runInTransaction: <T>(fn: () => Promise<T>) => Promise<T>;
}

const t = initTRPC.context<TRPCContext>().create();

const router = t.router;

// Base procedure that wraps execution in transaction context
const baseProcedure = t.procedure.use(async ({ ctx, next }) => {
  return ctx.runInTransaction(() => next());
});

const publicProcedure = baseProcedure;

const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: { ...ctx, user: ctx.user },
  });
});

export type { TRPCContext, Services };
export { router, publicProcedure, protectedProcedure };
