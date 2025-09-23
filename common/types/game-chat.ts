import type {
  WsClientEnvelope,
  WsServerOutbound,
} from '@common/types/websockets';

const GAME_CHAT_DOMAIN = 'game-chat';

// Directional message types
type GameChatClientMessageType = 'join-room' | 'leave-room' | 'post-message';
type GameChatServerMessageType = 'new-message';

// Client → Server messages (sent by clients)
namespace GameChatClient {
  export interface JoinRoomMessage extends WsClientEnvelope {
    type: 'join-room';
    payload: {
      room: string;
      timestamp: number;
    };
  }

  export interface LeaveRoomMessage extends WsClientEnvelope {
    type: 'leave-room';
    payload: {
      room: string;
      timestamp: number;
    };
  }

  export interface PostMessage extends WsClientEnvelope {
    type: 'post-message';
    payload: {
      room: string;
      content: string;
    };
  }
}

// Server → Client messages (emitted by server)
namespace GameChatServer {
  export interface NewMessageMessage extends WsServerOutbound {
    type: 'new-message';
    payload: {
      room: string;
      content: string;
      userId: number;
      username: string;
      timestamp: number;
    };
  }
}

export {
  GAME_CHAT_DOMAIN,
  type GameChatClientMessageType,
  type GameChatServerMessageType,
  type GameChatClient,
  type GameChatServer,
};
