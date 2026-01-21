import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import fp from 'fastify-plugin';

import { appRouter } from '@protocol/trpc/router';

import { logger } from '@/utils/logger';
import { createContext } from '@/trpc/context';

const trpcPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: ({ req }: { req: FastifyRequest }) => createContext(req),
      onError: ({ error, path }: { error: Error; path: string | undefined }) => {
        logger.error(`tRPC error on ${path}: ${error.message}`);
      },
    },
  });
};

export default fp(trpcPlugin, {
  name: 'trpc',
  dependencies: ['auth'],
});
