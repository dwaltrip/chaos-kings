import { FastifyInstance } from 'fastify';
import { findUser } from '@/user/actions/find-user';
import { createUser } from '@/user/actions/create-user';
import { updateUsername } from '@/user/actions/update-username';
import { autoCreateUser } from '@/user/actions/auto-create-user';
import { UserRepository } from '@/user/user-repository';
import { COOKIE_NAME, COOKIE_OPTIONS } from '@/user/user-key-cookie';
import { asyncHandler, parseId } from '@/utils/route-handler';

async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/users/:id', asyncHandler(async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = parseId(id);
  
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
    const userId = parseId(id);
    
    const user = await updateUsername(userId, username);
    return reply.send(user);
  }));

  // POST /users/auto-create
  fastify.post('/users/auto-create', asyncHandler(async (request, reply) => {
    const result = await autoCreateUser();
    reply.setCookie(COOKIE_NAME, result.user.user_key, COOKIE_OPTIONS);
    return reply.status(201).send(result);
  }));

  // GET /users/me
  fastify.get('/users/me', asyncHandler(async (request, reply) => {
    const userKey = request.cookies[COOKIE_NAME];
    if (!userKey) {
      return reply.status(200).send({ user: null });
    }
    
    const userRepository = new UserRepository();
    const user = await userRepository.findByUserKey(userKey);
    return reply.send({ user: user || null });
  }));

  // PUT /users/me/username
  fastify.put('/users/me/username', asyncHandler(async (request, reply) => {
    const userKey = request.cookies[COOKIE_NAME];
    const { username } = request.body as { username: string };
    if (!userKey) {
      return reply.status(401).send({ error: 'No user session found' });
    }
    
    const userRepository = new UserRepository();
    const user = await userRepository.findByUserKey(userKey);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    
    const updatedUser = await updateUsername(user.id, username);
    return reply.send(updatedUser);
  }));
}

export { userRoutes };
