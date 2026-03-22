import type { BurstInfo, BurstSpec, TimingState } from '../custom-algo-1/get-burst-info';

export interface FullBurstSpec extends BurstSpec {
  troopsNeeded: number;
}

interface TickEvent {
  tick: number;
  generalTroops: number;
  troopGain: boolean;
  action: 'waiting' | 'depart' | 'move';
  burstIdx: number;
  movesRemaining: number;
}

function simulateOneBurstVerbose(
  spec: FullBurstSpec,
  state: TimingState,
  burstIdx: number,
  maxTicks: number,
): { events: TickEvent[]; nextState: TimingState } | null {
  let { tick, generalTroops } = state;
  let movesRemaining = spec.moves;
  const events: TickEvent[] = [];

  while (movesRemaining > 0) {
    if (tick > maxTicks) return null;

    let action: TickEvent['action'];

    if (movesRemaining === spec.moves) {
      if (generalTroops >= spec.troopsNeeded) {
        generalTroops = 1;
        movesRemaining--;
        action = 'depart';
      } else {
        action = 'waiting';
      }
    } else {
      movesRemaining--;
      action = 'move';
    }

    const troopGain = tick % 2 === 0;
    if (troopGain) generalTroops++;

    events.push({ tick, generalTroops, troopGain, action, burstIdx, movesRemaining });
    tick++;
  }

  return { events, nextState: { tick, generalTroops } };
}

export function simulateVerbose(
  specs: FullBurstSpec[],
  maxTicks: number,
): TickEvent[] | null {
  let state: TimingState = { tick: 1, generalTroops: 1 };
  const allEvents: TickEvent[] = [];

  for (let i = 0; i < specs.length; i++) {
    const result = simulateOneBurstVerbose(specs[i], state, i, maxTicks);
    if (!result) return null;
    allEvents.push(...result.events);
    state = result.nextState;
  }

  return allEvents;
}

export function simulateSpecs(
  specs: FullBurstSpec[],
  maxTicks: number,
): BurstInfo[] | null {
  let state: TimingState = { tick: 1, generalTroops: 1 };
  const infos: BurstInfo[] = [];

  for (const spec of specs) {
    const result = simulateOneBurstVerbose(spec, state, 0, maxTicks);
    if (!result) return null;
    const endTick = result.events[result.events.length - 1].tick;
    infos.push({
      burstLen: spec.moves,
      startTick: endTick - spec.moves + 1,
      endTick,
    });
    state = result.nextState;
  }

  return infos;
}

export function printTickByTick(specs: FullBurstSpec[], maxTicks: number): void {
  const events = simulateVerbose(specs, maxTicks);
  if (!events) {
    console.log('  (exceeds max ticks)');
    return;
  }

  for (const e of events) {
    const parts: string[] = [];
    const spec = specs[e.burstIdx];
    const label = `[${spec.moves}m/${spec.captures}c]`;

    if (e.action === 'depart') {
      parts.push(`DEPART ${label} (${e.movesRemaining} moves left)`);
    } else if (e.action === 'move') {
      parts.push(`move ${label} (${e.movesRemaining} left)`);
    } else if (e.action === 'waiting') {
      parts.push(`waiting for ${label}`);
    }

    if (e.movesRemaining === 0 && (e.action === 'depart' || e.action === 'move')) {
      parts.push(`END ${label}`);
    }

    if (e.troopGain) parts.push('+1 troop');

    console.log(
      `  tick ${String(e.tick).padStart(3)}: gen=${String(e.generalTroops).padStart(3)}  ${parts.join(', ')}`,
    );
  }
}
