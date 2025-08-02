import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import { databasePlugin } from '@/plugins/database';
import { systemRoutes } from '@/system/system-routes';
import { userRoutes } from '@/user/user-routes';
import { gameRoutes } from '@/game/game-routes';

const PORT = 3131;

const fastify = Fastify({
  logger: true
});

fastify.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
});

fastify.register(fastifyCookie);
fastify.register(databasePlugin);
fastify.register(systemRoutes, { prefix: '/api' });
fastify.register(userRoutes, { prefix: '/api' });
fastify.register(gameRoutes, { prefix: '/api' });

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: 'localhost' });
    console.log(`🚀 Fastify server running on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
