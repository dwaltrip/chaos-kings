// TODO: [PHASE-2-INTEGRATION] This is a stub - not yet functional
// This file shows how v2 WS infrastructure will integrate with Fastify
// when we connect v2 to the actual running v1 server

// import type { FastifyRequest } from 'fastify';
// import type { WebSocket } from 'ws';
// import type { User } from '@common/types/user';
// import { setupWebSocketV2 } from '@/ws/server-bootstrap';

// Stub - shows how to initialize v2 WS server
// When integrated with v1 Fastify:
// 1. Import Fastify instance from v1 backend
// 2. Call setupWebSocketV2() to create WS server
// 3. Register WebSocket route handler

// function initializeWebSocketInfrastructure() {
//   const wsServer = setupWebSocketV2();
//   return wsServer;
// }

// Stub - shows how Fastify route would look
// When integrated:
// fastify.get('/ws', { websocket: true }, (connection, req) => {
//   const user = req.currentUser; // From Fastify auth middleware
//
//   if (!user) {
//     connection.socket.close(1008, 'Unauthorized');
//     return;
//   }
//
//   wsServer.handleConnection(connection.socket, user);
// });

// Example type signatures for reference when integrating
// type FastifyWebSocketHandler = (
//   connection: { socket: WebSocket },
//   req: FastifyRequest,
// ) => void;

// export { initializeWebSocketInfrastructure };
