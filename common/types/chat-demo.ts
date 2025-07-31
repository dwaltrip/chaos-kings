import type { WsMessage } from './websockets';

const CHAT_DEMO_DOMAIN = 'chat-demo';

namespace ChatDemo {
  export interface ChatMessage extends WsMessage {
    payload: {
      content: string;
      room: string;
      user: string;
      timestamp: number;
    }
  }

  export interface JoinRoomMessage extends WsMessage{
    payload: {
      room: string;
      user: string;
      timestamp: number;
    }
  }
}

function createNewChatMessage(content: string, room: string, user: string): ChatDemo.ChatMessage {
  return {
    domain: CHAT_DEMO_DOMAIN,
    type: 'new-message',
    payload: {
      content,
      room,
      user,
      timestamp: Date.now(),
    },
  };
}

function createJoinRoomMessage(room: string, user: string): WsMessage {
  return {
    domain: CHAT_DEMO_DOMAIN,
    type: 'join-room',
    payload: {
      room,
      user,
      timestamp: Date.now(),
    },
  };
}

export { CHAT_DEMO_DOMAIN, createNewChatMessage, createJoinRoomMessage, type ChatDemo };
