import { MsgCreators } from '@protocol/domains/chat/server-messages';

import { ChatMessageEntity } from '@/domains/chat/types';
// import { wsBridge } from "@/ws/bridge";
const wsBridge: any = {};

const chatWsEffects = {
  broadcastNewMessage({ roomId, content, userId, timestamp }: ChatMessageEntity) {
    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createBroadcastMessageMessage(roomId, content, userId, timestamp),
    );
  },
};

export { chatWsEffects };
