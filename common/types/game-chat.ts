import type { WsMessage } from './websockets';
import type { User } from './user';

const GAME_CHAT_DOMAIN = 'game-chat';

type GameChatMessageType = 'new-message' | 'join-room' | 'leave-room';

namespace GameChat {
  export interface ChatMessage extends WsMessage {
    payload: {
      content: string;
      room: string;
      timestamp: number;
      user?: User;
    }
  }

  export interface JoinRoomMessage extends WsMessage{
    payload: {
      room: string;
      timestamp: number;
    }
  }
}

function createNewChatMessage(content: string, room: string): GameChat.ChatMessage {
  return {
    domain: GAME_CHAT_DOMAIN,
    type: 'new-message',
    payload: {
      content,
      room,
      timestamp: Date.now(),
    },
  };
}

function createJoinRoomMessage(room: string): WsMessage {
  return {
    domain: GAME_CHAT_DOMAIN,
    type: 'join-room',
    payload: {
      room,
      timestamp: Date.now(),
    },
  };
}

export {
  GAME_CHAT_DOMAIN,
  createNewChatMessage,
  createJoinRoomMessage,
  type GameChat,
  type GameChatMessageType
};
