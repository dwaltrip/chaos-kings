import Fastify from 'fastify';
import cors from '@fastify/cors';
import databasePlugin from '@/plugins/database';
import healthRoutes from '@/routes/health';

const PORT = 3000;

const fastify = Fastify({
  logger: true
});

fastify.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:3000']
});

fastify.register(databasePlugin);
fastify.register(healthRoutes);

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