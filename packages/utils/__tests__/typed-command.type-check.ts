// Compile-time type tests for TypedCommand.
//
// This file is NOT executed — it's checked with tsc to verify that certain
// usage patterns produce type errors and others don't.
//
// Run:
//   npx tsc --noEmit --strict packages/utils/__tests__/typed-command.type-check.ts
//
// Expected: Tests A and B should produce TS errors. Tests C, D, and E should compile clean.

import { createTypedCommand, parseTypedCommand, runTypedCommand } from '../typed-command';

interface MyOptions {
  verbose?: boolean;
  output?: string;
}

// ---------------------------------------------------------------------------
// SHOULD ERROR — .action() after .argument()
// ---------------------------------------------------------------------------

// Test A: .argument() then .action() directly
// @ts-expect-error — .action() not allowed after .argument()
createTypedCommand<MyOptions>()
  .argument('[files...]', 'input files')
  .action((opts) => {
    console.log(opts);
  });

// Test B: .argument() then .option() then .action() — brand survives chaining
// @ts-expect-error — .action() not allowed after .argument(), even through .option()
createTypedCommand<MyOptions>()
  .argument('[files...]', 'input files')
  .option('--verbose', 'verbose')
  .action((opts) => {
    console.log(opts);
  });

// ---------------------------------------------------------------------------
// SHOULD COMPILE — .action() without .argument()
// ---------------------------------------------------------------------------

// Test C: options only, single option
createTypedCommand<MyOptions>()
  .option('--verbose', 'verbose')
  .action((opts) => {
    console.log(opts.verbose);
  });

// Test D: options only, multiple options chained
createTypedCommand<MyOptions>()
  .option('--verbose', 'verbose')
  .option('-o, --output <path>', 'output path')
  .action((opts) => {
    console.log(opts.verbose);
    console.log(opts.output);
  });

// ---------------------------------------------------------------------------
// SHOULD COMPILE — runTypedCommand() with .argument()
// ---------------------------------------------------------------------------

// Test E: runTypedCommand() callback style
const programE = createTypedCommand<MyOptions>()
  .option('--verbose', 'verbose')
  .argument('[files...]', 'input files');

runTypedCommand(programE, (opts, args) => {
  console.log(opts.verbose);
  console.log(args[0]);
});

// Test F: parseTypedCommand() return style
const programF = createTypedCommand<MyOptions>()
  .option('--verbose', 'verbose')
  .argument('[files...]', 'input files');

const { opts, args } = parseTypedCommand(programF);
console.log(opts.verbose);
console.log(args[0]);
