import { FastifyInstance } from 'fastify';
import { createGame } from '@/game/actions/create-game';
import { listGames } from '@/game/actions/list-games';
import { getGame } from '@/game/actions/get-game';
import { asyncHandler, parseId } from '@/utils/route-handler';

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
      const { id } = request.params as { id: string };
      const gameId = parseId(id);

      const game = await getGame(gameId);
      if (!game) {
        return reply.status(404).send({ error: 'Game not found' });
      }
      return reply.send({ game });
    }),
  );
}

export { gameRoutes };
