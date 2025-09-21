import { useMemo } from 'react';

import type { GameWithPlayers } from '@common/types/games';

interface GameStatusInfoProps {
  game: GameWithPlayers;
  isGameEnded: boolean;
  winner: number | null;
  playerMapping: { playerId: string; playerIndex: number }[] | null;
}

interface WinnerInfo {
  playerName: string;
}

function GameStatusInfo({
  game,
  isGameEnded,
  winner,
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
          (p) => p.user_id.toString() === winnerMapping.playerId,
        )
      : null;

    return {
      playerName: winnerPlayer
        ? `Player ${winnerPlayer.user_id}`
        : `Player ${winner}`,
    };
  }, [isGameEnded, winner, playerMapping, game.players]);

  return (
    <>
      <span>
        <strong>Status:</strong> {gameStatus}
      </span>
      {winnerInfo && (
        <span>
          <strong>Winner:</strong> {winnerInfo.playerName}
        </span>
      )}
    </>
  );
}

export { GameStatusInfo };
export type { GameStatusInfoProps, WinnerInfo };
