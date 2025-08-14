import { useMemo } from 'react';

import type { GameWithPlayers } from '@common/types/games';

interface GameStatusInfoProps {
  game: GameWithPlayers;
  isGameEnded: boolean;
  winner: number | null;
  endReason: 'general_captured' | 'timeout' | 'disconnect' | null;
  playerMapping: { playerId: string; playerIndex: number }[] | null;
}

interface WinnerInfo {
  playerName: string;
  reason: string;
}

function GameStatusInfo({
  game,
  isGameEnded,
  winner,
  endReason,
  playerMapping,
}: GameStatusInfoProps) {
  const gameStatus = useMemo(() => {
    if (isGameEnded) {
      return 'COMPLETED';
    }
    return game.status || 'UNKNOWN';
  }, [isGameEnded, game.status]);

  const winnerInfo = useMemo((): WinnerInfo | null => {
    if (!isGameEnded || winner === null || !playerMapping) {
      return null;
    }

    const winnerMapping = playerMapping.find((p) => p.playerIndex === winner);
    const winnerPlayer = winnerMapping
      ? game.players.find(
          (p) => p.player_id.toString() === winnerMapping.playerId,
        )
      : null;

    return {
      playerName: winnerPlayer
        ? `Player ${winnerPlayer.player_id}`
        : `Player ${winner}`,
      reason: endReason || 'unknown',
    };
  }, [isGameEnded, winner, playerMapping, game.players, endReason]);

  return (
    <>
      <span>
        <strong>Status:</strong> {gameStatus}
      </span>
      {winnerInfo && (
        <span>
          <strong>Winner:</strong> {winnerInfo.playerName} ({winnerInfo.reason})
        </span>
      )}
    </>
  );
}

export { GameStatusInfo };
export type { GameStatusInfoProps, WinnerInfo };
