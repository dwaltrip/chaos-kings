import { WsMessage } from '@common/types/websockets';

const JoinRoomMessageType = 'join-room';

function createJoinRoomMessage(domain: string, room: string): WsMessage {
  return {
    domain,
    type: JoinRoomMessageType,
    payload: {
      room,
      timestamp: Date.now(),
    },
  };
}

export { createJoinRoomMessage, JoinRoomMessageType };
