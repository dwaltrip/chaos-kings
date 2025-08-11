import 'fastify';
import { User } from '@common/types/user';

declare module 'fastify' {
  export interface FastifyRequest {
    currentUser?: User;
  }
}

