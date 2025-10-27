/**
 * Build WebSocket room ID for game chat
 * Format: chat:game-{gameId}
 */
function buildChatRoomId(gameId: number): string {
  return `chat:game-${gameId}`;
}

/**
 * Extract game ID from chat room ID
 * Returns null if room ID is not a valid chat room format
 */
function parseChatRoomId(roomId: string): number | null {
  const match = roomId.match(/^chat:game-(\d+)$/);
  if (!match) {
    return null;
  }
  const gameId = parseInt(match[1], 10);
  return isNaN(gameId) ? null : gameId;
}

export { buildChatRoomId, parseChatRoomId };
