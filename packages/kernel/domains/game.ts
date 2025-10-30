import type { Brand } from '@kernel/branded-type';

type GameId = Brand<number, 'GameId'>;

const GameId = (value: number): GameId => value as GameId;

export { GameId };
