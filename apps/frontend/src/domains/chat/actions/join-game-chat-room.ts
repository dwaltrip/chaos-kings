import { idToNumber } from '@kernel/branded-type';
import { RoomId, GameId } from '@kernel/ids';
import { buildChatRoomId } from '@platform/domains/chat/helpers';

import { systemWsEffects } from '@/domains/system/actions';

function joinGameChatRoom(gameId: GameId) {
  const roomId = RoomId(buildChatRoomId(idToNumber(gameId)));
  systemWsEffects.joinRoom(roomId);
}

function leaveGameChatRoom(gameId: GameId) {
  const roomId = RoomId(buildChatRoomId(idToNumber(gameId)));
  systemWsEffects.leaveRoom(roomId);
}

export { joinGameChatRoom, leaveGameChatRoom };
