import type { TimingConfig } from '@core/timing/types';
import { invariant } from '@utils/assertions/invariant';

import './turn-counter.css';

interface TurnCounterProps {
  tick: number;
  timingConfig: TimingConfig;
}

const MAX_TICKS_PER_TURN = 8;

function TurnCounter({ tick, timingConfig }: TurnCounterProps) {
  const ticksPerTurn = timingConfig.generalProductionTicks;
  invariant(
    ticksPerTurn <= MAX_TICKS_PER_TURN,
    `ticksPerTurn (${ticksPerTurn}) exceeds maximum of ${MAX_TICKS_PER_TURN}`,
  );

  const turnNumber = Math.floor(tick / ticksPerTurn);
  const ticksIntoTurn = tick % ticksPerTurn;
  const numDots = ticksIntoTurn;

  const maxDots = ticksPerTurn - 1;
  const dotWidth = 10;
  const reservedWidth = maxDots * dotWidth;

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white/80 p-3 shadow-sm">
      <div className="turn-counter-content">
        <span className="text-sm font-medium text-gray-700">Turn {turnNumber}</span>
        <span
          className="turn-dots"
          style={{ minWidth: `${reservedWidth}px` }}
          aria-label={`${numDots} ticks into turn`}
        >
          {'•'.repeat(numDots)}
        </span>
      </div>
    </div>
  );
}

export { TurnCounter };
