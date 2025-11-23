import { GameId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';
import { makeRoomId } from '@protocol/domains/system';

/**
 * Build WebSocket room slug from game ID (without domain prefix)
 * Used for joining/leaving game rooms for real-time gameplay
 * Returns bare slug like "game-123", combine with domain to get full RoomId
 *
 * NOTE: We could theoretically parse gameId back out of the room slug,
 * but we prefer to pass gameId explicitly in message payloads instead.
 */
function buildGameRoomId(gameId: GameId) {
  return makeRoomId('gameplay', `game-${idToNumber(gameId)}`);
}

export { buildGameRoomId };
