import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import websocket from '@fastify/websocket';

import { databasePlugin } from '@/plugins/database';
import authPlugin from '@/plugins/auth';
import trpcPlugin from '@/plugins/trpc';
import { setupWebSocketV2 } from '@/ws/server-bootstrap';
import { logger, fastifyLoggerConfig } from '@/utils/logger';

import { init as initSandbox } from '@/domains/sandbox/init';

import { systemRoutes } from '@/domains/system/system-routes';
import { userRoutes } from '@/domains/users/user-routes';
import { gameRoutes } from '@/domains/games/game-routes';
import { chatRoutes } from '@/domains/chat/chat-routes';

const fastify = Fastify({
  logger: fastifyLoggerConfig,
});

// Register plugins
fastify.register(cors, {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
});

fastify.register(fastifyCookie);
fastify.register(websocket);
fastify.register(databasePlugin);
fastify.register(authPlugin);
fastify.register(trpcPlugin);

// Register HTTP routes
fastify.register(systemRoutes, { prefix: '/api' });
fastify.register(userRoutes, { prefix: '/api' });
fastify.register(gameRoutes, { prefix: '/api' });
fastify.register(chatRoutes, { prefix: '/api' });

// Initialize v2 WebSocket server
const wsServer = setupWebSocketV2();

// Initialize domain hooks
initSandbox();

// WebSocket route
fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    // Auth plugin has already run on preHandler hook
    // req.currentUser is set if user has valid session cookie

    if (!req.currentUser) {
      connection.close(1008, 'Unauthorized');
      logger.warn('[WS] Rejected unauthorized connection attempt');
      return;
    }

    // Pass authenticated user to v2 WS server
    // Server will generate connectionId and create handler context
    wsServer.handleConnection(connection, req.currentUser);
  });
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3131;

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`🚀 v2 Server running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

export { startServer };
