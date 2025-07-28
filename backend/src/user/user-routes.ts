import { FastifyInstance } from 'fastify';
import { findUser } from '@/user/actions/find-user';
import { createUser } from '@/user/actions/create-user';
import { updateUsername } from '@/user/actions/update-username';

async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/users/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = parseInt(id, 10);

      if (isNaN(userId)) {
        return reply.status(400).send({ error: 'Invalid user ID' });
      }

      const user = await findUser(userId);

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send(user);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/users', async (request, reply) => {
    try {
      const { username } = request.body as { username: string };

      const user = await createUser(username);

      return reply.status(201).send(user);
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.put('/users/:id/username', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { username } = request.body as { username: string };
      const userId = parseInt(id, 10);

      if (isNaN(userId)) {
        return reply.status(400).send({ error: 'Invalid user ID' });
      }

      const user = await updateUsername(userId, username);

      return reply.send(user);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'User not found') {
          return reply.status(404).send({ error: error.message });
        }
        return reply.status(400).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

export { userRoutes };
