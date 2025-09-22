import type { GameChatEffects } from '@/game-chat/ws-effects';

async function postMessage(
  userId: number,
  username: string,
  room: string,
  content: string,
  effects: GameChatEffects,
): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) return;
  const capped = trimmed.slice(0, 500);
  const timestamp = Date.now();
  effects.broadcastNewMessage(room, {
    content: capped,
    userId,
    username,
    timestamp,
  });
}

export { postMessage };
