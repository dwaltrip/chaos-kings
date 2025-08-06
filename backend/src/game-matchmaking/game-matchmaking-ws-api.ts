import { DomainAPI } from '@/websocket/api';
import {
  GameMatchmaking,
  GameMatchmakingMessageType,
  GAME_MATCHMAKING_DOMAIN
} from '@common/types/game-matchmaking';
import { Game } from '@common/types/games';

const GameMatchmakingWsAPI = new DomainAPI<GameMatchmakingMessageType>(GAME_MATCHMAKING_DOMAIN, {
  'join-queue': (data: GameMatchmaking.JoinQueueMessage, wsActions) => {
  },
  'leave-queue': (data: GameMatchmaking.LeaveQueueMessage, wsActions) => {
  },
  'queue-status': (data: GameMatchmaking.QueueStatusMessage, wsActions) => {
  },
  'game-ready': (data: GameMatchmaking.GameReadyMessage, wsActions) => {
  },
});

export { GameMatchmakingWsAPI };
