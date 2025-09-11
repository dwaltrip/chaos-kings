const PlayerColor = {
  RED: 'RED',
  BLUE: 'BLUE',
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  ORANGE: 'ORANGE',
  PURPLE: 'PURPLE',
  PINK: 'PINK',
  SILVER: 'SILVER',
};

type PlayerColor = keyof typeof PlayerColor;
const PLAYER_COLORS = Object.keys(PlayerColor) as PlayerColor[];

const ColorMap: Map<PlayerColor, string> = new Map([
  ['RED', '#e33030'],
  ['BLUE', '#308ee3'],
  ['GREEN', '#2ecc71'],
  ['YELLOW', '#f1c40f'],
  ['ORANGE', '#e67e22'],
  ['PURPLE', '#9b59b6'],
  ['PINK', '#e84393'],
  ['SILVER', '#95a5a6'],
]);

export { PlayerColor, PLAYER_COLORS, ColorMap };
