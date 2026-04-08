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
  chain.forEach((burstSize) => {
    const targetArmy = burstSize + 1;
    let prev = { ...state };
    state = corridorBurst(state, targetArmy);
    console.log('prev:', prev, '-- after:', state);
    data.push({
      startTick: state.tick - (burstSize - 1),
      size: burstSize,
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
