import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import { databasePlugin } from '@/plugins/database';
import authPlugin from '@/plugins/auth';
import { systemRoutes } from '@/system/system-routes';
import { userRoutes } from '@/user/user-routes';
import { gameRoutes } from '@/game/game-routes';
import { 
  WebSocketManager,
  handleWebSocketMessage,
} from '@/websocket';
import { registerDomainAPI } from '@/websocket/api';
import { GameChatWsAPI } from '@/game-chat/game-chat-ws-api';
import { GameMatchmakingWsAPI } from '@/game-matchmaking/game-matchmaking-ws-api';
import { GameplayWsAPI } from '@/gameplay/gameplay-ws-api';
import { initializeGameCoordinator } from '@/gameplay/game-coordinator';
import { setGlobalWebSocketManager } from '@/websocket/global-manager';

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
fastify.register(websocket);
fastify.register(databasePlugin);
fastify.register(authPlugin);
fastify.register(systemRoutes, { prefix: '/api' });
fastify.register(userRoutes, { prefix: '/api' });
fastify.register(gameRoutes, { prefix: '/api' });

// Initialize WebSocket manager and register domain APIs
const wsManager = new WebSocketManager();
setGlobalWebSocketManager(wsManager);
registerDomainAPI(GameChatWsAPI);
registerDomainAPI(GameMatchmakingWsAPI);
registerDomainAPI(GameplayWsAPI);

// Initialize game coordinator
initializeGameCoordinator();

// WebSocket route
fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    wsManager.handleConnection(connection, req);
  });
});

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

