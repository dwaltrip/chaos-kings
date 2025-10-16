/**
 * Build WebSocket room ID from game ID
 * Used for joining/leaving game rooms for real-time gameplay
 */
function buildGameRoomId(gameId: number): string {
  return `game-${gameId}`;
}

/**
 * Extract game ID from room ID
 * Returns null if room ID is not a valid game room format
 */
function parseGameRoomId(roomId: string): number | null {
  const match = roomId.match(/^game-(\d+)$/);
  if (!match) {
    return null;
  }
  const gameId = parseInt(match[1], 10);
  return isNaN(gameId) ? null : gameId;
}

export { buildGameRoomId, parseGameRoomId };
