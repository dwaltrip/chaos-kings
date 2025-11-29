import { FastifyInstance } from 'fastify';
import { GameId } from '@kernel/ids';

import { asyncHandler, parseId } from '@/utils/route-handler';
import { getGame, listGames } from '@/domains/games/actions';

async function gameRoutes(fastify: FastifyInstance) {
  // POST /api/games - Create new game
  // fastify.post('/games', asyncHandler(async (request, reply) => {
  //   const game = await createGame();
  //   return reply.status(201).send({ game });
  // }));

  // GET /api/games - List all games
  fastify.get(
    '/games',
    asyncHandler(async (request, reply) => {
      const games = await listGames();
      return reply.send({ games });
    }),
  );

  // GET /api/games/:id - Get game by ID
  fastify.get(
    '/games/:id',
    asyncHandler(async (request, reply) => {
      // TODO: Are there easy / nice ways of having request.params auto-typed?
      // Should be able to use the URL string above?
      const { id } = request.params as { id: string };
      const gameId = GameId(parseId(id));

      const game = await getGame(gameId);
      if (!game) {
        return reply.status(404).send({ error: 'Game not found' });
      }
      return reply.send({ game });
    }),
  );
}

export { gameRoutes };
