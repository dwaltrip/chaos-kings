import { FastifyInstance } from 'fastify';

import { GameId } from '@kernel/ids';
import { idToNumber, idToString } from '@kernel/branded-type';

import { asyncHandler, parseId } from '@/utils/route-handler';
import { ChatMessageRepository } from '@/domains/chat/chat-message-repository';

async function chatRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/games/:gameId/chat',
    asyncHandler(async (request, reply) => {
      // TODO: Are there easy / nice ways of having request.params auto-typed?
      // Should be able to use the URL string above?
      const { gameId: gameIdParam } = request.params as { gameId: string };
      const gameId = GameId(parseId(gameIdParam));

      const chatRepo = new ChatMessageRepository();
      const messages = await chatRepo.findGameChatsByGameId(gameId);
      const dtos = messages.map((msg) => ({
        ...msg,
        id: idToNumber(msg.id),
        roomId: idToString(msg.roomId),
        userId: idToNumber(msg.userId),
      }));

      return reply.send({ messages: dtos });
    }),
  );
}

export { chatRoutes };
