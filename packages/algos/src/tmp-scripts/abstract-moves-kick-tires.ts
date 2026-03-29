import { MAX_TICK } from '../perfect-start-solver/custom-algo-2/core-constraints/constants';
import { countAbstractMovePatterns } from '../perfect-start-solver/custom-algo-2/core-constraints/abstract-moves';
import { getAllAbstractMovePatterns } from '../perfect-start-solver/custom-algo-2/core-constraints/abstract-moves-v2';
import { numStr } from '@/perfect-start-solver/custom-algo-2/core-constraints/helpers';

function main() {
  console.group('--- Abstract Moves: kick the tires ---');
  console.log('MAX_TICK:', MAX_TICK);

  // const count = getAllAbstractMovePatterns().length;
  const count = countAbstractMovePatterns();
  console.log('count:', count);
}

function main2() {
  const cfg = { maxTick: 13 };
  console.log('--- COUNT:', countAbstractMovePatterns(cfg));
  console.log();

  const results = getAllAbstractMovePatterns(cfg);
  results.forEach((res, i) => {
    const label = `[${numStr(i + 1, 2)}]`;
    console.log(label.padEnd(6) + res.map((b) => b.size).join(','));
    console.log(
      ''.padEnd(6) + res.map((b) => `${b.firstMoveTick},${b.size}`).join(' | '),
    );
    console.log();
  });
}

// main();
main2();
