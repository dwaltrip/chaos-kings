import { idToNumber, idToString } from '@kernel/branded-type';
import { MsgCreators } from '@protocol/domains/chat/server-messages';

import { ChatMessageEntity } from '@/domains/chat/types';
// import { wsBridge } from "@/ws/bridge";
const wsBridge: any = {};

const chatWsEffects = {
  broadcastNewMessage({ roomId, content, userId, timestamp }: ChatMessageEntity) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createBroadcastMessageMessage(
        idToString(roomId),
        content,
        idToNumber(userId),
        timestamp,
      ),
    );
  },
};

export { chatWsEffects };
