import { idToNumber } from '@kernel/branded-type';
import { GameId } from '@kernel/ids';
import { MsgCreators } from '@protocol/domains/chat/client-messages';

import { wsBridge } from '@/ws';

const chatWsEffects = {
  sendMessage(gameId: GameId, content: string) {
    wsBridge.send(MsgCreators.createSendMessageMessage(idToNumber(gameId), content));
  },
};

export { chatWsEffects };
