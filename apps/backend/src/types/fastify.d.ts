import 'fastify';
import { User } from '@packages/domains/users/types-deprecated';

declare module 'fastify' {
  export interface FastifyRequest {
    currentUser?: User;
  }
}
