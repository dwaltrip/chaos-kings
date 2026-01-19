// Static imports - dynamic imports don't help here since these stores are
// already statically imported elsewhere in the app (actions, pages, etc.)
import { chatStore } from '@/domains/chat/chat-store';
import { useGameplayStoreV2 } from '@/domains/gameplay/stores/gameplay-store-v2';
import { gameMatchmakingStore } from '@/domains/matchmaking/matchmaking-store';
import { usePuzzleStore } from '@/domains/puzzles/stores/puzzle-store';
import { userStore } from '@/domains/users/user-store';

import { registerDebugStore } from './index';

function registerDebugStores(): void {
  if (!import.meta.env.DEV) return;

  registerDebugStore('puzzle', usePuzzleStore);
  registerDebugStore('gameplay', useGameplayStoreV2);
  registerDebugStore('matchmaking', gameMatchmakingStore);
  registerDebugStore('user', userStore);
  registerDebugStore('chat', chatStore);

  console.log('[debug] Registered stores:', 'puzzle, gameplay, matchmaking, user, chat');
}

export { registerDebugStores };
