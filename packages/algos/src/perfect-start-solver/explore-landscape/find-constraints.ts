import { maxSingleBurst } from './max-single-burst';

/*
  With max tick = 50 
    - [x] Maximum possible single burst?
    - Maximum amount of overlap with (for given capture target (CT))
    - Maximum amount of overlap just based off ticks
*/

function findConstraints() {
  const constraints = {
    maxSingleBurst: maxSingleBurst(),
  };

  return constraints;
}

function main() {
  const constraints = findConstraints();

  console.log('maxSingleBurst:', constraints.maxSingleBurst);
}

main();
