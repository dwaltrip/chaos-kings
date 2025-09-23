import type { WsActions } from '@/websocket/types';
import { roomKey } from '@common/utils/room-key';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';

interface GameplayEffects {
  joinGameplayRoom(room: string): void;
  leaveGameplayRoom(room: string): void;
}

function createGameplayEffects(wsActions: WsActions): GameplayEffects {
  return {
    joinGameplayRoom(room: string) {
      wsActions.joinRoom(roomKey(GAMEPLAY_DOMAIN, room));
    },
    leaveGameplayRoom(room: string) {
      wsActions.leaveRoom(roomKey(GAMEPLAY_DOMAIN, room));
    },
  };
}

export { createGameplayEffects, type GameplayEffects };
