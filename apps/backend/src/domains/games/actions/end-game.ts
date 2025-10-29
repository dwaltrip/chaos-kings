import { GameState } from '@core/types';
import { GameWithPlayers } from '@common/types/games';
import type { MoveHistoryV1 } from '@core/replay/types';

import { logger } from '@/utils/logger';
import { GameRepository } from '@/domains/games/game-repository';
import { GameStatus } from '@/domains/games/types';

interface EndGameParams {
  game: GameWithPlayers;
  winnerPlayerIndex: number;
  finalGameState: GameState;
  reason: 'general_captured' | 'timeout' | 'forfeit';
  moveHistory: MoveHistoryV1;
}

async function endGame({
  game,
  winnerPlayerIndex,
  finalGameState,
  reason,
  moveHistory,
}: EndGameParams): Promise<void> {
  logger.info(
    `Ending game ${game.id}, winner: player ${winnerPlayerIndex}, reason: ${reason}`,
  );

  try {
    const gameRepository = new GameRepository();

    // Prepare the final game state to persist
    const gameStateToSave = {
      board: finalGameState.board,
      tick: finalGameState.tick,
      endedAt: new Date().toISOString(),
      winner: winnerPlayerIndex,
      endReason: reason,
    };

    // Update status, game_state and move_history in a single operation
    await gameRepository.updateStatusGameStateAndMoveHistory(
      game.id,
      GameStatus.COMPLETE,
      gameStateToSave,
      moveHistory,
    );

    logger.info(`Successfully ended game ${game.id} and saved final state`);
  } catch (error) {
    logger.error(`Failed to end game ${game.id}. Error: ${error}`);
    throw error;
  }
}

export { endGame, EndGameParams };
