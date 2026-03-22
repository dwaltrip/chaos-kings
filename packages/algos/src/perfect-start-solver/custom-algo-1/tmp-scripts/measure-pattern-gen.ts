// @ts-nocheck
import { genDescendingPartitions, genValidBurstPatterns } from '../burst-patterns';
import { getBurstInfos } from '../get-burst-info';

const MAX_BURST = 12;
const MAX_TICKS = 50;

console.log('totalMoves | partitions | valid (<=50t) | best endTick');
console.log('-----------|------------|---------------|-------------');

for (let total = 22; total <= 28; total++) {
  const allPartitions = genDescendingPartitions(total, MAX_BURST);
  const valid = genValidBurstPatterns(total, MAX_BURST, MAX_TICKS);

  // find the partition with the earliest endTick
  let bestEnd = Infinity;
  let bestPattern: number[] = [];
  for (const p of allPartitions) {
    const infos = getBurstInfos(p);
    const endTick = infos[infos.length - 1].endTick;
    if (endTick < bestEnd) {
      bestEnd = endTick;
      bestPattern = p;
    }
  }

  console.log(
    `    ${String(total).padStart(2)}     |    ${String(allPartitions.length).padStart(5)}   |     ${String(valid.length).padStart(4)}      |  ${bestEnd} ${JSON.stringify(bestPattern)}`,
  );
}
