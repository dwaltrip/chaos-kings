import { ChatMessageId } from '@kernel/domains/chat';
import { GameId } from '@kernel/domains/game';
import { RoomId } from '@kernel/domains/system';
import { UserId } from '@kernel/domains/user';

// TODO: Migrate existing callers to import from '@kernel/ids' for consistency.

export { ChatMessageId, GameId, RoomId, UserId };
