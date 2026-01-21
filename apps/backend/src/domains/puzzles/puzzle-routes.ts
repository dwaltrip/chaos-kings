import { FastifyInstance } from 'fastify';

import { asyncHandler } from '@/utils/route-handler';
import { puzzleAttemptRepository } from '@/domains/puzzles/puzzle-attempt-repository';

async function puzzleRoutes(fastify: FastifyInstance) {
  // GET /api/puzzles/stats - Get user's aggregate puzzle stats
  fastify.get(
    '/puzzles/stats',
    asyncHandler(async (request, reply) => {
      const user = request.currentUser;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const stats = await puzzleAttemptRepository.getUserStats(user.id);
      return reply.send(stats);
    }),
  );
}

export { puzzleRoutes };
