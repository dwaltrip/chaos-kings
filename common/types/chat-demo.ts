import type { WsMessage } from './websockets';

const CHAT_DEMO_DOMAIN = 'chat-demo';

namespace ChatDemo {
  export interface ChatMessageData {
    content: string;
    room: string;
  }

  export interface ChatMessagePayload {
    type: 'chat-message';
    data: ChatMessageData;
    user: string;
    timestamp: number;
  }

  export interface JoinRoomData {
    room: string;
  }

  export interface JoinRoomPayload {
    type: 'join-room';
    data: JoinRoomData;
    user: string;
    timestamp: number;
  }
}

function createChatMessage(content: string, room: string, user: string): WsMessage {
  return {
    user,
    domain: CHAT_DEMO_DOMAIN,
    payload: {
      type: 'chat-message',
      data: { content, room }
    },
    timestamp: Date.now()
  };
}

function createJoinRoomMessage(room: string, user: string): WsMessage {
  return {
    user,
    domain: CHAT_DEMO_DOMAIN,
    payload: {
      type: 'join-room',
      data: { room }
    },
    timestamp: Date.now()
  };
}

export type { ChatDemo };
export { CHAT_DEMO_DOMAIN, createChatMessage, createJoinRoomMessage };