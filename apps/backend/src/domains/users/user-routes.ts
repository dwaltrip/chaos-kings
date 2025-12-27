import { FastifyInstance } from 'fastify';

import { asyncHandler, parseId } from '@/utils/route-handler';
import {
  findUser,
  createUser,
  autoCreateUser,
  updateUsername,
} from '@/domains/users/actions';
import { userRepository } from '@/domains/users/user-repository';
import {
  USER_KEY_COOKIE_NAME,
  USER_KEY_COOKIE_OPTIONS,
} from '@/domains/users/user-key-cookie';

async function userRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/users/:id',
    asyncHandler(async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = parseId(id);

      const user = await findUser(userId);
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }
      return reply.send(user);
    }),
  );

  fastify.post(
    '/users',
    asyncHandler(async (request, reply) => {
      const { username } = request.body as { username: string };
      const user = await createUser(username);
      return reply.status(201).send(user);
    }),
  );

  fastify.put(
    '/users/:id/username',
    asyncHandler(async (request, reply) => {
      const { id } = request.params as { id: string };
      const { username } = request.body as { username: string };
      const userId = parseId(id);

      const user = await updateUsername(userId, username);
      return reply.send(user);
    }),
  );

  // POST /users/auto-create
  fastify.post(
    '/users/auto-create',
    asyncHandler(async (request, reply) => {
      // If user is already authenticated, return existing user instead of creating new one
      // This prevents cookie overwrites when multiple auto-create calls race
      if (request.currentUser) {
        const existingUser = await userRepository.findByUserKey(
          request.currentUser.user_key,
        );
        if (existingUser) {
          return reply.status(200).send({ user: existingUser, isNewUser: false });
        }
      }

      const result = await autoCreateUser();
      reply.setCookie(
        USER_KEY_COOKIE_NAME,
        result.user.user_key,
        USER_KEY_COOKIE_OPTIONS,
      );
      return reply.status(201).send(result);
    }),
  );

  // GET /users/me
  fastify.get(
    '/users/me',
    asyncHandler(async (request, reply) => {
      const userKey = request.cookies[USER_KEY_COOKIE_NAME];
      if (!userKey) {
        return reply.status(200).send({ user: null });
      }

      const user = await userRepository.findByUserKey(userKey);
      return reply.send({ user: user || null });
    }),
  );

  // PUT /users/me/username
  fastify.put(
    '/users/me/username',
    asyncHandler(async (request, reply) => {
      const userKey = request.cookies[USER_KEY_COOKIE_NAME];
      const { username } = request.body as { username: string };
      if (!userKey) {
        return reply.status(401).send({ error: 'No user session found' });
      }

      const user = await userRepository.findByUserKey(userKey);
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const updatedUser = await updateUsername(user.id, username);
      return reply.send(updatedUser);
    }),
  );
}

export { userRoutes };
