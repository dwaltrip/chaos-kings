// Show prefix sets for a board + overlap pattern.
//
// Usage:
//   npx tsx .../show-prefix-sets.ts --board corner-13x13 --overlaps 0,1,1,0
//   npx tsx .../show-prefix-sets.ts --board 3-22.tight-edge-with-chokes --overlaps 0,1,0,1 --crop 6
//   npx tsx .../show-prefix-sets.ts --board pocket-11x11 --overlaps 0,1,1 --depth 3 --max 5

import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import { getPrefixSets, formatPrefixSet } from '../prefix-utils';

interface Options {
  board: string;
  overlaps: string;
  depth: string;
  max: string;
  crop: string;
}

const { opts } = parseTypedCommand(
  createTypedCommand<Options>()
    .name('show-prefix-sets')
    .description('Enumerate and display prefix sets for a board + overlap pattern')
    .requiredOption('--board <name>', 'Board name')
    .requiredOption('--overlaps <list>', 'Comma-separated overlap pattern, e.g. 0,1,1,0')
    .option('--depth <n>', 'Prefix depth', '4')
    .option('--max <n>', 'Max sets to show', '10')
    .option('--crop <n>', 'Crop board to N tiles around general', ''),
);

const overlaps = opts.overlaps.split(',').map(Number);
const depth = Number(opts.depth);
const max = Number(opts.max);
const crop = opts.crop ? Number(opts.crop) : undefined;

const { sets, count, capped, board, generalPos } = getPrefixSets(opts.board, overlaps, {
  depth,
});

const show = Math.min(max, sets.length);
console.log(`${opts.board}, D=${depth}, overlaps=[${overlaps}]`);
console.log(`${count} sets${capped ? ` (capped at ${count})` : ''}, showing ${show}\n`);

for (let i = 0; i < show; i++) {
  console.log(`--- Set ${i + 1} ---`);
  console.log(formatPrefixSet(board, generalPos, sets[i], overlaps, crop));
  console.log();
}
