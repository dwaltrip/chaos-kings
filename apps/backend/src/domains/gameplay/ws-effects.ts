import { idToString, idToNumber } from '@kernel/branded-type';
import { GameId, RoomId } from '@kernel/ids';
import { MsgCreators } from '@protocol/domains/gameplay/server-messages';

import type { BoardState, PlayerIndex, PlayerMapping } from '@core/types';
import type { PlayerQueuesMap, PlayerStats } from '@platform/domains/gameplay/types';
import type { GameWithPlayers } from '@platform/domains/games/types';

import { wsBridge } from '@/ws/server-bridge-bootstrap';

const gameplayWsEffects = {
  /**
   * Broadcast game state update (called every tick during active gameplay)
   * V1: GameServer.broadcastGameState()
   */
  broadcastGameState(
    roomId: RoomId,
    tick: number,
    boardState: BoardState,
    playerQueues?: PlayerQueuesMap,
    playerStats: PlayerStats[] = [],
  ) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createStateUpdateMessage(tick, boardState, playerQueues, playerStats),
    );
  },

  /**
   * Broadcast countdown notification (called every second before game starts)
   * V1: GameServer countdown timer callback
   */
  broadcastGameStarting(roomId: RoomId, gameId: GameId, countdown: number) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createGameStartingMessage(idToNumber(gameId), countdown),
    );
  },

  /**
   * Broadcast game started (called once when countdown reaches 0)
   * V1: GameServer.startGame()
   */
  broadcastGameStarted(
    roomId: RoomId,
    gameId: GameId,
    playerMapping: PlayerMapping,
    boardState: BoardState,
    game: GameWithPlayers,
  ) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createGameStartedMessage(
        idToNumber(gameId),
        playerMapping,
        boardState,
        game,
      ),
    );
  },

  /**
   * Broadcast game ended (called once when game completes)
   * V1: GameServer.endGame()
   */
  broadcastGameEnded(roomId: RoomId, winner: PlayerIndex, finalBoardState: BoardState) {
    wsBridge.broadcastToRoom(
      idToString(roomId),
      MsgCreators.createGameEndedMessage(winner, finalBoardState),
    );
  },
};

export { gameplayWsEffects };
