

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

export { PlayerColor, PLAYER_COLORS };

