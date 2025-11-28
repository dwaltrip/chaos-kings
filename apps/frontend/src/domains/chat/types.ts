import type { ChatServerPayloadMap } from '@protocol/domains/chat/server-messages';

type ChatMessage = ChatServerPayloadMap['chat:broadcast-message'];

export type { ChatMessage };
