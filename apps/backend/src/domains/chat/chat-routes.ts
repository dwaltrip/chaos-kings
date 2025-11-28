import { FastifyInstance } from 'fastify';

import { GameId } from '@kernel/ids';

import { asyncHandler, parseId } from '@/utils/route-handler';
import { ChatMessageRepository } from '@/domains/chat/chat-message-repository';

async function chatRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/games/:gameId/chat',
    asyncHandler(async (request, reply) => {
      const { gameId: gameIdParam } = request.params as { gameId: string };
      const gameId = GameId(parseId(gameIdParam));

      const chatRepo = new ChatMessageRepository();
      const messages = await chatRepo.findGameChatsByGameId(gameId);

      const serialized = messages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        userId: msg.user_id,
        username: msg.username,
        timestamp: msg.created_at.getTime(),
      }));

      return reply.send({ messages: serialized });
    }),
  );
}

export { chatRoutes };
