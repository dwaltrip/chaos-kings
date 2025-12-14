import type { Brand } from '@kernel/branded-type';

type GameId = Brand<number, 'GameId'>;

const GameId = (value: number): GameId => value as GameId;

// NOTE: This only exists because URL params are strings
const GameIdFromURLParam = (value: string): GameId => {
  // TODO: do we need error handling for invalid number strings?
  return parseInt(value, 10) as GameId;
};

export { GameId, GameIdFromURLParam };
