import type { ClientWsActions } from '@/websocket/types';
import { roomKey } from '@common/utils/room-key';
import { GAMEPLAY_DOMAIN } from '@common/types/gameplay';

interface GameplayEffects {
  joinGameplayRoom(room: string): void;
  leaveGameplayRoom(room: string): void;
}

function createGameplayEffects(wsActions: ClientWsActions): GameplayEffects {
  return {
    joinGameplayRoom(room: string) {
      wsActions.join(roomKey(GAMEPLAY_DOMAIN, room));
    },
    leaveGameplayRoom(room: string) {
      wsActions.leave(roomKey(GAMEPLAY_DOMAIN, room));
    },
  };
}

export { createGameplayEffects, type GameplayEffects };
