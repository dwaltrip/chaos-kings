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
