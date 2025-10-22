// ---------------------------------------------------
// TODO: Think about how to organize validation logic
// in gneeral across the app
// ---------------------------------------------------
import { PLAYER_COLORS } from '@core/colors';

interface Result {
  valid: boolean;
  errors: string[] | null;
}

function isValidForCreateGame({
  playerCount,
  playerIds,
}: {
  playerCount: number;
  playerIds: number[];
}): Result {
  const errors: string[] = [];

  if (playerCount < 2) {
    errors.push('At least two players are required.');
  }

  if (playerCount > PLAYER_COLORS.length) {
    errors.push(`Too many players. Maximum allowed: ${PLAYER_COLORS.length}`);
  }

  // Check for duplicate player IDs
  const uniquePlayerIds = new Set(playerIds);
  if (uniquePlayerIds.size !== playerIds.length) {
    errors.push('Duplicate player IDs are not allowed.');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : null,
  };
}

export { isValidForCreateGame };
