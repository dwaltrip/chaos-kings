import {
  type BurstSizeChain,
  corridorBurst,
  CorridorState,
} from '../questions/q2-equivalent-burst-chains-simple';

interface CorridorBurstInfo {
  startTick: number;
  size: number;
  armyOnLastMoveTick: number;
}

function corridorCompleteBurstSequence(chain: BurstSizeChain): CorridorBurstInfo[] {
  const data: CorridorBurstInfo[] = [];
  let state: CorridorState = { tick: 0, generalArmy: 1, frontier: 0 };
  chain.forEach((burst) => {
    let prev = { ...state };
    state = corridorBurst(state, burst);
    console.log('prev:', prev, '-- after:', state);
    data.push({
      // state.tick is the last move tick in the burst.
      startTick: state.tick - (burst - 1),
      size: burst,
      armyOnLastMoveTick: state.generalArmy,
    });
  });
  return data;
}

function debuggingCorridorBursts() {
  const data = corridorCompleteBurstSequence([3, 1, 1, 1]);
  console.log(JSON.stringify(data, null, 2));
}

function main() {
  debuggingCorridorBursts();
}

main();
