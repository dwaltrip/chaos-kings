import { type GameChatServer } from '@common/types/game-chat';

type ChatMessage = GameChatServer.NewMessageMessage['payload'];

export { type ChatMessage };
