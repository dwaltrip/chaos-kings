import 'fastify';
import { User } from '@platform/domains/users/types-deprecated';

declare module 'fastify' {
  export interface FastifyRequest {
    currentUser?: User;
  }
}
