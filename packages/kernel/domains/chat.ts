import type { Brand } from '@kernel/branded-type';

type ChatMessageId = Brand<number, 'ChatMessageId'>;

const ChatMessageId = (value: number): ChatMessageId => value as ChatMessageId;

export { ChatMessageId };
