import type { WsMessage } from '@common/types/websockets';

const JoinRoomMessageType = 'join-room';
const LeaveRoomMessageType = 'leave-room';

interface JoinRoomMessage extends WsMessage {
  payload: {
    room: string;
    timestamp: number;
  };
}

interface LeaveRoomMessage extends WsMessage {
  payload: {
    room: string;
    timestamp: number;
  };
}

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

function createLeaveRoomMessage(domain: string, room: string): WsMessage {
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
