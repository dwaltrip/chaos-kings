import type { MessageUnion } from '@protocol/utils/message-helpers';
import type { ExtractMsg } from '@protocol/utils/type-helpers';

import type { BoardState, PlayerIndex } from '@core/types';
import type { GameWithPlayers } from '@platform/domains/games/types';
import type { PlayerQueuesMap, PlayerStats } from '@platform/domains/gameplay/types';

type GameplayServerPayloadMap = {
  'gameplay:state-update': {
    tick: number;
    boardState: BoardState;
    playerQueues?: PlayerQueuesMap;
    playerStats: PlayerStats[];
  };

  'gameplay:game-starting': {
    gameId: number;
    countdown: number;
  };

  'gameplay:game-started': {
    gameId: number;
    boardState: BoardState;
    game: GameWithPlayers;
  };

  'gameplay:game-ended': {
    winner: PlayerIndex;
    finalBoardState: BoardState;
  };
};

type GameplayServerMessage = MessageUnion<GameplayServerPayloadMap>;
type StateUpdateMessage = ExtractMsg<GameplayServerMessage, 'gameplay:state-update'>;
type GameStartingMessage = ExtractMsg<GameplayServerMessage, 'gameplay:game-starting'>;
type GameStartedMessage = ExtractMsg<GameplayServerMessage, 'gameplay:game-started'>;
type GameEndedMessage = ExtractMsg<GameplayServerMessage, 'gameplay:game-ended'>;

const MsgCreators = {
  createStateUpdateMessage: (
    tick: number,
    boardState: BoardState,
    playerQueues?: PlayerQueuesMap,
    playerStats: PlayerStats[] = [],
  ): StateUpdateMessage => ({
    type: 'gameplay:state-update',
    payload: { tick, boardState, playerQueues, playerStats },
  }),

  createGameStartingMessage: (
    gameId: number,
    countdown: number,
  ): GameStartingMessage => ({
    type: 'gameplay:game-starting',
    payload: { gameId, countdown },
  }),

  createGameStartedMessage: (
    gameId: number,
    boardState: BoardState,
    game: GameWithPlayers,
  ): GameStartedMessage => ({
    type: 'gameplay:game-started',
    payload: { gameId, boardState, game },
  }),

  createGameEndedMessage: (
    winner: PlayerIndex,
    finalBoardState: BoardState,
  ): GameEndedMessage => ({
    type: 'gameplay:game-ended',
    payload: { winner, finalBoardState },
  }),
} as const;

export type { GameplayServerPayloadMap, GameplayServerMessage };
export { MsgCreators };
