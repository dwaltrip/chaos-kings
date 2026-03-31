import { MAX_TICK } from '../constants';
import { numStr } from '../helpers';
import { countAbstractMovePatterns } from '../abstract-moves';
import { getAllAbstractMovePatterns } from '../abstract-moves-v2';

function main() {
  console.group('--- Abstract Moves: kick the tires ---');
  console.log('MAX_TICK:', MAX_TICK);

  // const count = getAllAbstractMovePatterns().length;
  const count = countAbstractMovePatterns();
  console.log('count:', count);
}

function main2() {
  const cfg = { maxTick: 20 };
  const count = countAbstractMovePatterns(cfg);

  const results = getAllAbstractMovePatterns(cfg);
  if (results.length !== count) {
    console.error('uh oh... counts do not match!');
  }

  results.forEach((res, i) => {
    const label = `[${numStr(i + 1, 3)}]`;
    const burstLengths = res.map((b) => b.size).join(',');
    const burstChainDetails = res
      .map((b) => `${numStr(b.firstMoveTick, 2)},${numStr(b.size, 2)}`)
      .join(' | ');

    console.log(label.padEnd(6) + burstChainDetails);
    // console.log(label.padEnd(6) + burstLengths);
    // console.log(''.padEnd(6) + burstChainDetails);
    // console.log();
  });
}

// main();
main2();
