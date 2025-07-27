import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { db } from '@/db';
import { getClient } from '@/services/redis';

async function databasePlugin(fastify: FastifyInstance) {
  fastify.decorate('db', db);
  fastify.decorate('getRedisClient', getClient);
}

export default fp(databasePlugin);