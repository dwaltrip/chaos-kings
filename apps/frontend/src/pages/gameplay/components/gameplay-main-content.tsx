import { GameCountdown } from '@/pages/gameplay/components/gameplay-countdown';
import { GameUI } from '@/domains/gameplay/ui/game-ui';

interface GameMainContentProps {
  gameId: number;
  gameStatus: string;
  countdownActive: boolean;
  countdownSeconds: number;
}

function GameplayMainContent({
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

export { GameplayMainContent };
export type { GameMainContentProps };
