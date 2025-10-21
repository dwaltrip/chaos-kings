import type { ChatClientMessage } from '@protocol/domains/chat/client-messages';
import type { ChatServerMessage } from '@protocol/domains/chat/server-messages';
import type { MatchmakingClientMessage } from '@protocol/domains/matchmaking/client-messages';
import type { MatchmakingServerMessage } from '@protocol/domains/matchmaking/server-messages';
import type { GameplayClientMessage } from '@protocol/domains/gameplay/client-messages';
import type { GameplayServerMessage } from '@protocol/domains/gameplay/server-messages';
import type { SystemClientMessage } from '@protocol/domains/system/client-messages';
import type { SystemServerMessage } from '@protocol/domains/system/server-messages';

// Union of all client messages (client → server)
type ClientMessage =
  | ChatClientMessage
  | MatchmakingClientMessage
  | GameplayClientMessage
  | SystemClientMessage;

// Union of all server messages (server → client)
type ServerMessage =
  | ChatServerMessage
  | MatchmakingServerMessage
  | GameplayServerMessage
  | SystemServerMessage;

export type { ClientMessage, ServerMessage };
