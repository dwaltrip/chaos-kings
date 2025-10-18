import { idToString } from '@kernel/branded-type';
import { RoomId } from '@kernel/domains/system';
import { MsgCreators } from '@protocol/domains/chat/client-messages';

// TODO: [PHASE-2] Import wsBridge when available
// import { wsBridge } from '@/ws/bridge';
const wsBridge: any = {};

const chatWsEffects = {
  sendMessage(roomId: RoomId, content: string) {
    wsBridge.send(MsgCreators.createSendMessageMessage(idToString(roomId), content));
  },
};

export { chatWsEffects };
