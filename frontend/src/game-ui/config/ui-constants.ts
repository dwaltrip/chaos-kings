const PLAYER_COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24'] as const;

const DEFAULT_PLAYER_COLOR = '#777';

function playerIndexToColor(playerIndex: number): string {
  return PLAYER_COLORS[playerIndex] || DEFAULT_PLAYER_COLOR;
}

export { PLAYER_COLORS, DEFAULT_PLAYER_COLOR, playerIndexToColor };
