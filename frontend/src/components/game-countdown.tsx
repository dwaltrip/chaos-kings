import { useEffect, useState } from 'react';

interface GameCountdownProps {
  countdown: number;
  isActive: boolean;
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
}

function GameCountdown({
  countdown,
  isActive,
  title = 'Game Found!',
  subtitle = 'Starting in...',
  onComplete,
}: GameCountdownProps) {
  const [prevCountdown, setPrevCountdown] = useState(countdown);

  useEffect(() => {
    if (countdown <= 0 && prevCountdown > 0 && onComplete) {
      onComplete();
    }
    setPrevCountdown(countdown);
  }, [countdown, prevCountdown, onComplete]);

  if (!isActive) {
    return null;
  }

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = ((5 - countdown) / 5) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg border border-gray-200 shadow-lg">
      <h2 className="text-2xl font-bold text-green-600 mb-4">{title}</h2>

      <div className="relative w-32 h-32 mb-4">
        <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="rgb(229, 231, 235)"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="rgb(34, 197, 94)"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold text-gray-800 transition-all duration-300">
            {countdown}
          </span>
        </div>
      </div>

      <p className="text-lg text-gray-600 font-medium">{subtitle}</p>
    </div>
  );
}

export { GameCountdown };
