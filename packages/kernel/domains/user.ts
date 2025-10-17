import { Brand } from '@kernel/branded-type';

type UserId = Brand<number, 'UserId'>;

const UserId = (value: number): UserId => value as UserId;

export type { UserId };
export { UserId };
