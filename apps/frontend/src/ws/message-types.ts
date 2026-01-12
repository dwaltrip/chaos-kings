import type { ChatClientMessage } from '@protocol/domains/chat/client-messages';
import type { ChatServerMessage } from '@protocol/domains/chat/server-messages';

import type { GameplayClientMessage } from '@protocol/domains/gameplay/client-messages';
import type { GameplayServerMessage } from '@protocol/domains/gameplay/server-messages';

import type { PuzzlesClientMessage } from '@protocol/domains/puzzles/client-messages';
import type { PuzzlesServerMessage } from '@protocol/domains/puzzles/server-messages';

import type { MatchmakingClientMessage } from '@protocol/domains/matchmaking/client-messages';
import type { MatchmakingServerMessage } from '@protocol/domains/matchmaking/server-messages';

import type { SystemClientMessage } from '@protocol/domains/system/client-messages';
import type { SystemServerMessage } from '@protocol/domains/system/server-messages';

type ClientMessage =
  | ChatClientMessage
  | MatchmakingClientMessage
  | GameplayClientMessage
  | PuzzlesClientMessage
  | SystemClientMessage;

type ServerMessage =
  | ChatServerMessage
  | MatchmakingServerMessage
  | GameplayServerMessage
  | PuzzlesServerMessage
  | SystemServerMessage;

export type { ClientMessage, ServerMessage };
