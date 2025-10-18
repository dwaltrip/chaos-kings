import { idToString, idToNumber } from '@kernel/branded-type';
import { GameId } from '@kernel/domains/game';
import { RoomId } from '@kernel/domains/system';
import { MsgCreators } from '@protocol/domains/gameplay/client-messages';
import type { Coord, Direction } from '@core/types';
import type { BoardState, PlayerIndex, PlayerMapping } from '@core/types';
import type { PlayerQueuesMap } from '@common/types/gameplay';
import type { GameWithPlayers } from '@common/types/games';

// TODO: [PHASE-2] Import wsClient when available
// import { wsClient } from '@/services/websocket';

const gameplayActions = {
  // ============================================================================
  // OUTBOUND: Send messages to server
  // ============================================================================

  sendJoinRoom(roomId: RoomId) {
    // TODO: [GAMEPLAY-FE] Send join-room message via ws client
    // const msg = MsgCreators.createJoinRoomMessage(idToString(roomId));
    // wsClient.send(msg);
    // Note: Room ID typically built from gameId using buildGameRoomId() helper
  },

  sendLeaveRoom(roomId: RoomId) {
    // TODO: [GAMEPLAY-FE] Send leave-room message via ws client
    // const msg = MsgCreators.createLeaveRoomMessage(idToString(roomId));
    // wsClient.send(msg);
  },

  sendMoveRequest(sourceCoord: Coord, direction: Direction) {
    // TODO: [GAMEPLAY-FE] Send move-request message via ws client
    // const msg = MsgCreators.createMoveRequestMessage(sourceCoord, direction);
    // wsClient.send(msg);
    // Note: This is called from game UI when player clicks/drags to move armies
    // Consider optimistic update: add to local queue immediately, wait for server confirmation
  },

  sendCancelMoves() {
    // TODO: [GAMEPLAY-FE] Send cancel-moves message via ws client
    // const msg = MsgCreators.createCancelMovesMessage();
    // wsClient.send(msg);
    // Note: Called when player clicks "Clear Moves" button
    // Consider optimistic update: clear local queue immediately
  },

  sendUndoMove(gameId: GameId) {
    // TODO: [GAMEPLAY-FE] Send undo-move message via ws client
    // const msg = MsgCreators.createUndoMoveMessage(idToNumber(gameId));
    // wsClient.send(msg);
    // Note: Called when player presses undo hotkey (e.g., 'Z')
    // Consider optimistic update: pop from local queue immediately
  },

  // ============================================================================
  // INBOUND: Handle messages from server
  // ============================================================================

  handleGameState(payload: {
    tick: number;
    boardState: BoardState;
    playerQueues?: PlayerQueuesMap;
  }) {
    // TODO: [GAMEPLAY-FE] Update store with game state
    // - Update board state in store
    // - Update tick counter
    // - Update player move queues for UI display
    // - Trigger fog of war recalculation based on player's vision
    // - V1: gameplay-store-v2.setGameState(boardState, tick, playerQueues)
    // - V1 file: /frontend/src/game-ui/store/gameplay-store-v2.ts
    // Decision needed: Use existing gameplay-store-v2 or create new v2 store?
  },

  handleGameStarting(payload: { gameId: GameId; countdown: number }) {
    // TODO: [GAMEPLAY-FE] Display countdown notification
    // - Display countdown overlay (5... 4... 3... 2... 1...)
    // - Prepare game UI (show board, controls)
    // - Store gameId for future messages
    // - V1: Update countdown in store or UI state
    // - V1 file: /frontend/src/game-ui/store/gameplay-ws-handler.ts
  },

  handleGameStarted(payload: {
    gameId: GameId;
    playerMapping: PlayerMapping;
    boardState: BoardState;
    game: GameWithPlayers;
  }) {
    // TODO: [GAMEPLAY-FE] Initialize game in store
    // - Set player mapping (which player index is current user)
    // - Set initial board state
    // - Display game UI, hide countdown
    // - Store game metadata for UI display (players, game type, etc.)
    // - V1: gameplay-store-v2.resetGame() + setGameState()
    // - V1 file: /frontend/src/game-ui/store/gameplay-store-v2.ts
  },

  handleGameEnded(payload: { winner: PlayerIndex; finalBoardState: BoardState }) {
    // TODO: [GAMEPLAY-FE] Handle game end
    // - Display winner announcement (YOU WIN / YOU LOSE)
    // - Show final board state
    // - Disable game controls
    // - Handle navigation (stay on page, offer rematch, return to lobby?)
    // - V1: gameplay-store-v2 update winner field
    // - V1 file: /frontend/src/game-ui/store/gameplay-store-v2.ts
    // Decision needed: Where should player navigate after game ends?
  },
};

export { gameplayActions };
