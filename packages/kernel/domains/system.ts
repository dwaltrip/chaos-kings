import type { Brand } from '@kernel/branded-type';

type RoomId = Brand<string, 'RoomId'>;

const RoomId = (value: string): RoomId => value as RoomId;

export { RoomId };
