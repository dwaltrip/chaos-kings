import type { WsClientEnvelope } from '@common/types/websockets';

const JoinRoomMessageType = 'join-room';
const LeaveRoomMessageType = 'leave-room';

interface JoinRoomMessage extends WsClientEnvelope {
  payload: {
    room: string;
    timestamp: number;
  };
}

interface LeaveRoomMessage extends WsClientEnvelope {
  payload: {
    room: string;
    timestamp: number;
  };
}

function createJoinRoomMessage(domain: string, room: string): WsClientEnvelope {
  return {
    domain,
    type: JoinRoomMessageType,
    payload: {
      room,
      timestamp: Date.now(),
    },
  };
}

function createLeaveRoomMessage(
  domain: string,
  room: string,
): WsClientEnvelope {
  return {
    domain,
    type: LeaveRoomMessageType,
    payload: {
      room,
      timestamp: Date.now(),
    },
  };
}

export {
  createJoinRoomMessage,
  JoinRoomMessageType,
  createLeaveRoomMessage,
  LeaveRoomMessageType,
  type JoinRoomMessage,
  type LeaveRoomMessage,
};
