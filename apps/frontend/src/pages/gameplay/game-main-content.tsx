import { GameCountdown } from '@/components/game-countdown';
import { GameUI } from '@/game-ui/game-ui';

interface GameMainContentProps {
  gameId: number;
  gameStatus: string;
  countdownActive: boolean;
  countdownSeconds: number;
}

function GameMainContent({
  gameId,
  gameStatus,
  countdownActive,
  countdownSeconds,
}: GameMainContentProps) {
  if (countdownActive) {
    return (
      <GameCountdown
        countdown={countdownSeconds}
        isActive={countdownActive}
        title="Game Starting!"
        subtitle="Get ready..."
      />
    );
  }

  if (gameStatus === 'not_started') {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="text-xl text-gray-600 mb-4">Waiting for game to start...</div>
        <div className="text-sm text-gray-500">Players are joining the game</div>
      </div>
    );
  }

  return <GameUI gameId={gameId} />;
}

export { GameMainContent };
export type { GameMainContentProps };
