import { MessageType, PayloadFor } from '@protocol/utils/message-helpers';

// import type { BroadcastOptions } from './bridge';
type BroadcastOptions = any;

interface HandlerContext {
  userId: string;
}

type DomainHandler<
  TUnion extends { type: string; payload: unknown },
  TType extends MessageType<TUnion>,
> = (payload: PayloadFor<TUnion, TType>, ctx: HandlerContext) => void | Promise<void>;

type DomainHandlers<TUnion extends { type: string; payload: unknown }> = {
  [K in MessageType<TUnion>]: DomainHandler<TUnion, K>;
};

export type { HandlerContext, DomainHandler, DomainHandlers, BroadcastOptions };
