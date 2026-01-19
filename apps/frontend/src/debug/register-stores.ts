import { registerDebugStore } from './index';

// Lazy import stores to avoid circular dependencies and bundle bloat
// Only runs in dev mode since initializeDebug guards everything

async function registerDebugStores(): Promise<void> {
  if (!import.meta.env.DEV) return;

  try {
    // Core stores
    const { usePuzzleStore } = await import('@/domains/puzzles/stores/puzzle-store');
    registerDebugStore('puzzle', usePuzzleStore);

    const { useGameplayStoreV2 } = await import(
      '@/domains/gameplay/stores/gameplay-store-v2'
    );
    registerDebugStore('gameplay', useGameplayStoreV2);

    const { gameMatchmakingStore } = await import(
      '@/domains/matchmaking/matchmaking-store'
    );
    registerDebugStore('matchmaking', gameMatchmakingStore);

    const { userStore } = await import('@/domains/users/user-store');
    registerDebugStore('user', userStore);

    const { chatStore } = await import('@/domains/chat/chat-store');
    registerDebugStore('chat', chatStore);

    console.log(
      '[debug] Registered stores:',
      'puzzle, gameplay, matchmaking, user, chat',
    );
  } catch (err) {
    console.warn('[debug] Failed to register some stores:', err);
  }
}

export { registerDebugStores };
