import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import { databasePlugin } from '@/plugins/database';
import { systemRoutes } from '@/system/system-routes';
import { userRoutes } from '@/user/user-routes';

const PORT = 3000;

const fastify = Fastify({
  logger: true
});

fastify.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:3000']
});

fastify.register(fastifyCookie);
fastify.register(databasePlugin);
fastify.register(systemRoutes);
fastify.register(userRoutes);

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Fastify server running on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
