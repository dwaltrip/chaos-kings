import { MsgCreators } from '@protocol/domains/gameplay/server-messages';
import type { BoardState, PlayerIndex, PlayerMapping } from '@core/types';
import type { PlayerQueuesMap } from '@common/types/gameplay';
import type { GameWithPlayers } from '@common/types/games';

// TODO: [PHASE-2] Replace with actual wsBridge implementation
const wsBridge: any = {};

const gameplayWsEffects = {
  /**
   * Broadcast game state update (called every tick during active gameplay)
   * V1: GameServer.broadcastGameState()
   */
  broadcastGameState(
    roomId: string,
    tick: number,
    boardState: BoardState,
    playerQueues?: PlayerQueuesMap,
  ) {
    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createStateUpdateMessage(tick, boardState, playerQueues),
    );
  },

  /**
   * Broadcast countdown notification (called every second before game starts)
   * V1: GameServer countdown timer callback
   */
  broadcastGameStarting(roomId: string, gameId: number, countdown: number) {
    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createGameStartingMessage(gameId, countdown),
    );
  },

  /**
   * Broadcast game started (called once when countdown reaches 0)
   * V1: GameServer.startGame()
   */
  broadcastGameStarted(
    roomId: string,
    gameId: number,
    playerMapping: PlayerMapping,
    boardState: BoardState,
    game: GameWithPlayers,
  ) {
    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createGameStartedMessage(gameId, playerMapping, boardState, game),
    );
  },

  /**
   * Broadcast game ended (called once when game completes)
   * V1: GameServer.endGame()
   */
  broadcastGameEnded(roomId: string, winner: PlayerIndex, finalBoardState: BoardState) {
    wsBridge.broadcastToRoom(
      roomId,
      MsgCreators.createGameEndedMessage(winner, finalBoardState),
    );
  },
};

export { gameplayWsEffects };
