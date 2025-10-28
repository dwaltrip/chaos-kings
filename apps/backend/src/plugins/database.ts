import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { db } from '@/services/db';
import { getClient } from '@/services/redis';

const databasePlugin = fp(function (fastify: FastifyInstance) {
  fastify.decorate('db', db);
  fastify.decorate('getRedisClient', getClient);
});

export { databasePlugin };
