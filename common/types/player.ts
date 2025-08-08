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

const ColorMap = new Map([
  [PlayerColor.RED, '#e33030'],
  [PlayerColor.BLUE, '#308ee3'],
]);

class Player {
  id: number;
  username: string;
  color: PlayerColor;

  constructor(id: number, username: string, color: PlayerColor) {
    this.id = id;
    this.username = username;
    this.color = color;
  }
}

function getPlayerColorInHex(player: Player): string {
  return ColorMap.get(player.color) || '#ddd';
}

export { Player, PlayerColor, getPlayerColorInHex };
