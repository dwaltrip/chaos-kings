import { tickForGeneralArmy } from '../helpers';
import {
  type BurstSizeChain,
  corridorBurst,
  CorridorState,
} from '../questions/q2-equivalent-burst-chains-simple';

// function formatChainGroup(chains: BurstSizeChain) {
// }

/*
  g  1  1  1 
` g  *  *  *  1

  [3] (g) (*) (*) (1)

+------------+
| 3, 1, 1, 1 |
+------------+
  (3)  g  1  1  1            | tick = ( 5, 10), gen-army = 4
                ^
  (1)  g  *  *  *  1         | tick = ( 5, 10), gen-army = 4
                   ^
  (1)  g  *  *  *  *  1      | tick = ( 5, 10), gen-army = 4
                      ^
  (1)  g  *  *  *  *  *  1   | tick = ( 5, 10), gen-army = 4
                         ^
+------------+
| 3, 1, 1, 1 |
+------------+
  (3)  g  1  1  1            | tick = ( 5, 10), gen-army = 4
                ^
  (1)  g  *  *  *  1         | tick = ( 5, 10), gen-army = 4
                   ^
  (1)  g  *  *  *  *  1      | tick = ( 5, 10), gen-army = 4
                      ^
  (1)  g  *  *  *  *  *  1   | tick = ( 5, 10), gen-army = 4
                         ^
    
*/

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

// function printChain(chain: BurstSizeChain) {
function printChain() {
  // const longest = Math.max(...chain);
  // const fmtBurst = (burst: number) => `${burst}`;
  // const strSizePerNum = 3;

  // corridorBurst
  const foo = corridorCompleteBurstSequence([3, 1, 1, 1]);
  console.log(JSON.stringify(foo, null, 2));

  const testStr = `
+------------+
| 3, 1, 1, 1 |
+------------+
  (3)  g  1  1  1            | tick = ( 5, 10), gen-army = 4
                ^
  (1)  g  *  *  *  1         | tick = ( 5, 10), gen-army = 4
                   ^
  (1)  g  *  *  *  *  1      | tick = ( 5, 10), gen-army = 4
                      ^
  (1)  g  *  *  *  *  *  1   | tick = ( 5, 10), gen-army = 4
                         ^
+------------+
| 3, 1, 1, 1 |
+------------+
  (3)  g  1  1  1            | tick = ( 5, 10), gen-army = 4
                ^
  (1)  g  *  *  *  1         | tick = ( 5, 10), gen-army = 4
                   ^
  (1)  g  *  *  *  *  1      | tick = ( 5, 10), gen-army = 4
                      ^
  (1)  g  *  *  *  *  *  1   | tick = ( 5, 10), gen-army = 4
                         ^`;
  console.log();
  console.log(testStr);
  console.log();
  // console.group('-'.repeat(longest));
  // console.log()
}

function main() {
  // vizInTerminal();
  printChain();
}

main();
