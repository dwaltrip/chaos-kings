/**
 * Game Timing Configuration
 *
 * This file centralizes all timing constants for the game system. All timing values
 * are specified in milliseconds and define the core game speed characteristics.
 *
 * Architecture Notes:
 * - Movement interval is the shortest interval and drives the overall tick rate
 * - All other intervals must be evenly divisible by the movement interval
 * - This allows easy game speed configuration by adjusting interval values
 */

const ONE_SECOND_MS = 1000;

// Movement interval drives the game tick rate since it's the shortest interval.
// Players can make one move every MOVEMENT_INTERVAL_MS milliseconds.
// export const MOVEMENT_INTERVAL_MS = 250;
const MOVEMENT_INTERVAL_MS = 500;

// Tick rate matches movement interval since movement is the most frequent action.
// This ensures moves are processed at the desired rate.
const TICK_RATE_MS = MOVEMENT_INTERVAL_MS;

const GENERAL_PRODUCTION_INTERVAL_MS = 1 * ONE_SECOND_MS;
const ARMY_PRODUCTION_INTERVAL_MS = 25 * ONE_SECOND_MS;

function validateTimingConfig(): void {
  // Movement interval should be the shortest interval (drives tick rate)
  if (MOVEMENT_INTERVAL_MS > GENERAL_PRODUCTION_INTERVAL_MS) {
    throw new Error(
      `Invalid timing configuration: MOVEMENT_INTERVAL_MS (${MOVEMENT_INTERVAL_MS}) ` +
        `must be less than or equal to GENERAL_PRODUCTION_INTERVAL_MS (${GENERAL_PRODUCTION_INTERVAL_MS})`,
    );
  }

  if (GENERAL_PRODUCTION_INTERVAL_MS % TICK_RATE_MS !== 0) {
    throw new Error(
      `Invalid timing configuration: GENERAL_PRODUCTION_INTERVAL_MS (${GENERAL_PRODUCTION_INTERVAL_MS}) ` +
        `must be evenly divisible by TICK_RATE_MS (${TICK_RATE_MS})`,
    );
  }

  if (ARMY_PRODUCTION_INTERVAL_MS % TICK_RATE_MS !== 0) {
    throw new Error(
      `Invalid timing configuration: ARMY_PRODUCTION_INTERVAL_MS (${ARMY_PRODUCTION_INTERVAL_MS}) ` +
        `must be evenly divisible by TICK_RATE_MS (${TICK_RATE_MS})`,
    );
  }

  if (ARMY_PRODUCTION_INTERVAL_MS <= GENERAL_PRODUCTION_INTERVAL_MS) {
    throw new Error(
      `Invalid timing configuration: ARMY_PRODUCTION_INTERVAL_MS (${ARMY_PRODUCTION_INTERVAL_MS}) ` +
        `must be greater than GENERAL_PRODUCTION_INTERVAL_MS (${GENERAL_PRODUCTION_INTERVAL_MS})`,
    );
  }
}

validateTimingConfig();

const GENERAL_PRODUCTION_TICKS = GENERAL_PRODUCTION_INTERVAL_MS / TICK_RATE_MS;
const ARMY_PRODUCTION_TICKS = ARMY_PRODUCTION_INTERVAL_MS / TICK_RATE_MS;

export { TICK_RATE_MS, GENERAL_PRODUCTION_TICKS, ARMY_PRODUCTION_TICKS };
