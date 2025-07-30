import { FastifyInstance } from 'fastify';
import { findUser } from '@/user/actions/find-user';
import { createUser } from '@/user/actions/create-user';
import { updateUsername } from '@/user/actions/update-username';
import { asyncHandler, parseUserId } from '@/utils/route-handler';

async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/users/:id', asyncHandler(async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = parseUserId(id);

    const user = await findUser(userId);

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(user);
  }));

  fastify.post('/users', asyncHandler(async (request, reply) => {
    const { username } = request.body as { username: string };

    const user = await createUser(username);

    return reply.status(201).send(user);
  }));

  fastify.put('/users/:id/username', asyncHandler(async (request, reply) => {
    const { id } = request.params as { id: string };
    const { username } = request.body as { username: string };
    const userId = parseUserId(id);

    const user = await updateUsername(userId, username);

    return reply.send(user);
  }));
}

export { userRoutes };
