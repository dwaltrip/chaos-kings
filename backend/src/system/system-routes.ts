import { FastifyInstance } from 'fastify';

async function systemRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'generals-v2-backend'
    };
  });
}

export { systemRoutes };

