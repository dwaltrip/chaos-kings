import { FastifyRequest, FastifyReply } from 'fastify';
import { runInContextWithTransaction } from '@/context/app-context';

type RouteHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<any>;

function asyncHandler(handler: RouteHandler) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await runInContextWithTransaction(() => handler(request, reply));
    } catch (error) {
      if (error instanceof Error) {
        // Handle known error types with specific status codes
        if (error.message === 'User not found') {
          return reply.status(404).send({ error: error.message });
        }
        // Default to 400 for other Error instances
        return reply.status(400).send({ error: error.message });
      }

      // Log unknown errors and return generic 500 response
      request.server.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  };
}

function parseId(id: string): number {
  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    throw new Error('Invalid ID');
  }
  return userId;
}

export { asyncHandler, parseId };
