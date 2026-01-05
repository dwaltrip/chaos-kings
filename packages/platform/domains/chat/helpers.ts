/**
 * Build WebSocket room ID for game chat
 * Format: chat:game-{gameId}
 */
function buildChatRoomId(gameId: number): string {
  return `chat:game-${gameId}`;
}

export { buildChatRoomId };
