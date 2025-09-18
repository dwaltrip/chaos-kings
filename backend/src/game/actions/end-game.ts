import { GameRepository } from '@/game/game-repository';
import { GameStatus } from '@/game/types';
import { GameState } from '@core/types';
import { logger } from '@/utils/logger';
import type { MoveHistoryV1 } from '@core/replay/types';

interface EndGameParams {
  gameId: number;
  winnerPlayerIndex: number;
  finalGameState: GameState;
  reason: 'general_captured' | 'timeout' | 'forfeit';
  moveHistory?: MoveHistoryV1;
}

async function endGame({
  gameId,
  winnerPlayerIndex,
  finalGameState,
  reason,
  moveHistory,
}: EndGameParams): Promise<void> {
  logger.info(
    `Ending game ${gameId}, winner: player ${winnerPlayerIndex}, reason: ${reason}`,
  );

  try {
    const gameRepository = new GameRepository();

    // Prepare the final game state to persist
    const gameStateToSave = {
      board: finalGameState.board,
      tick: finalGameState.tick,
      config: finalGameState.config,
      endedAt: new Date().toISOString(),
      winner: winnerPlayerIndex,
      endReason: reason,
    };

    // Update status, game_state and move_history in a single operation
    if (moveHistory) {
      await gameRepository.updateStatusGameStateAndMoveHistory(
        gameId,
        GameStatus.COMPLETE,
        gameStateToSave,
        moveHistory,
      );
    } else {
      await gameRepository.updateStatusAndGameState(
        gameId,
        GameStatus.COMPLETE,
        gameStateToSave,
      );
    }

    logger.info(`Successfully ended game ${gameId} and saved final state`);
  } catch (error) {
    logger.error(`Failed to end game ${gameId}:`, error);
    throw error;
  }
}

export { endGame, EndGameParams };
