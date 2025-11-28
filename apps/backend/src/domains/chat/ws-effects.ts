import { idToNumber, idToString } from '@kernel/branded-type';
import { MsgCreators } from '@protocol/domains/chat/server-messages';

import { wsBridge } from '@/ws/server-bridge-bootstrap';
import { ChatMessageEntity } from '@/domains/chat/types';

const chatWsEffects = {
  broadcastNewMessage({
    id,
    roomId,
    content,
    userId,
    username,
    timestamp,
  }: ChatMessageEntity) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createBroadcastMessageMessage(
        idToNumber(id),
        idToString(roomId),
        content,
        idToNumber(userId),
        username,
        timestamp,
      ),
    );
  },
};

export { chatWsEffects };
