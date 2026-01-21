import type { FastifyRequest } from 'fastify';

import type { TRPCContext, Services } from '@protocol/trpc/trpc';

import { runInContextWithTransaction } from '@/context/app-context';
import { puzzleService } from '@/domains/puzzles/service';

function createServices(): Services {
  return { puzzle: puzzleService };
}

function createContext(request: FastifyRequest): TRPCContext {
  const user = request.currentUser;
  return {
    user: user ? { id: user.id, username: user.username } : null,
    services: createServices(),
    runInTransaction: runInContextWithTransaction,
  };
}

export { createContext };
