import { idToString } from '@kernel/branded-type';
import { RoomId } from '@kernel/domains/system';
import { MsgCreators } from '@protocol/domains/chat/client-messages';

import { wsBridge } from '@/ws';

const chatWsEffects = {
  sendMessage(roomId: RoomId, content: string) {
    wsBridge.send(MsgCreators.createSendMessageMessage(idToString(roomId), content));
  },
};

export { chatWsEffects };
