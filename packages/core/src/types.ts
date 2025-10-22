interface GameState {
  board: BoardState;
  tick: number;
  // TODO: define / implement game config
}

type PlayerIndex = number;
type PlayerMapping = { playerId: string; playerIndex: PlayerIndex }[];

interface CompletedGameState {
  board: BoardState;
  tick: number;
  endedAt: string;
  winner: number;
  endReason: 'general_captured' | 'timeout' | 'forfeit';
}

interface BoardState {
  grid: GameGrid;
  size: Size2d;
}

type Coord = { x: number; y: number };

type Size2d = { width: number; height: number };

const PlayerSquareType = {
  GENERAL: 'GENERAL',
  ARMY: 'ARMY',
  PLAYER_CITY: 'PLAYER_CITY',
} as const;
type PlayerSquareType = (typeof PlayerSquareType)[keyof typeof PlayerSquareType];

const NeutralSquareType = {
  BLANK: 'BLANK',
  MOUNTAIN: 'MOUNTAIN',
  NEUTRAL_CITY: 'NEUTRAL_CITY',
} as const;
type NeutralSquareType = (typeof NeutralSquareType)[keyof typeof NeutralSquareType];

const SquareType = { ...PlayerSquareType, ...NeutralSquareType };
type SquareType = PlayerSquareType | NeutralSquareType;

interface _BaseSquare {
  coord: Coord;
}

interface NeutralSquare extends _BaseSquare {
  type: NeutralSquareType;
}

interface PlayerSquare extends _BaseSquare {
  type: PlayerSquareType;
  // 0-based index of the player owning this square
  playerIndex: number;
  units: number;
}

type Square = NeutralSquare | PlayerSquare;

type GameGrid = Square[][];

const Direction = {
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
} as const;
type Direction = (typeof Direction)[keyof typeof Direction];

export { Direction, PlayerSquareType, NeutralSquareType, SquareType };

export type {
  GameState,
  PlayerIndex,
  PlayerMapping,
  CompletedGameState,
  BoardState,
  Coord,
  Size2d,
  NeutralSquare,
  PlayerSquare,
  Square,
  GameGrid,
};
