
interface WsMessage {
  domain: string;
  payload: {
    type: string;
    data: any;
  }
  user: string;
  timestamp: number;
}

interface ChatMessageData {
  content: string;
  room: string;
}

interface ChatMessagePayload {
  type: 'chat-message';
  data: ChatMessageData;
  user: string;
  timestamp: number;
}

function createChatMessage(content: string, room: string, user: string): WsMessage {
  return {
    user,
    domain: 'chat-demo',
    payload: {
      type: 'chat-message',
      data: { content, room }
    },
    timestamp: Date.now()
  };
}

export type { WsMessage, ChatMessageData, ChatMessagePayload };
export { createChatMessage };
