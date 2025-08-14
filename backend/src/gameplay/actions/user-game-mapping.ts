const userGameMapping: Map<string, number> = new Map();

export function addUserToGame(userId: string, gameId: number): void {
  userGameMapping.set(userId, gameId);
  console.log(`[GameplayActions] Added user ${userId} to game ${gameId}`);
}

export function removeUserFromGame(userId: string): void {
  const gameId = userGameMapping.get(userId);
  if (gameId) {
    userGameMapping.delete(userId);
    console.log(`[GameplayActions] Removed user ${userId} from game ${gameId}`);
  }
}

export function getUserGame(userId: string): number | undefined {
  return userGameMapping.get(userId);
}
