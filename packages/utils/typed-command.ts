/**
 * Typed Command Wrapper for Commander.js
 * ========================================
 *
 * Commander.js's fluent API makes it impossible for TypeScript to infer option
 * types — `options` in `.action()` defaults to `any`. This wrapper fixes that
 * by letting you declare your options interface upfront via a generic.
 *
 * ## Usage
 *
 * ### Options only — use .action()
 *
 * ```ts
 * interface DeployOptions {
 *   env: string;
 *   force?: boolean;
 * }
 *
 * createTypedCommand<DeployOptions>()
 *   .option('-e, --env <env>', 'environment')
 *   .option('--force', 'force deployment')
 *   .action((opts) => {
 *     console.log(opts.env);   // typed, autocomplete works
 *     console.log(opts.force); // typed, autocomplete works
 *   })
 *   .parse();
 * ```
 *
 * ### With positional args — use parseTypedCommand() or runTypedCommand()
 *
 * Commander passes positional args before options in the .action() callback,
 * which breaks our typed override. Two alternatives:
 *
 * **parseTypedCommand** — returns typed opts + args, good for top-level scripts:
 *
 * ```ts
 * const program = createTypedCommand<BuildOptions>()
 *   .argument('[files...]', 'input files')
 *   .option('--watch', 'watch mode');
 *
 * const { opts, args } = parseTypedCommand(program);
 * console.log(opts.watch); // typed
 * console.log(args);       // string[]
 * ```
 *
 * **runTypedCommand** — callback style, good for wrapping a main function:
 *
 * ```ts
 * function main(opts: BuildOptions, files: string[]) { ... }
 *
 * const program = createTypedCommand<BuildOptions>()
 *   .argument('[files...]', 'input files')
 *   .option('--watch', 'watch mode');
 *
 * runTypedCommand(program, main);
 * ```
 *
 * If you accidentally call .action() after .argument(), you'll get both a
 * compile-time type error and a runtime exception.
 *
 * ## Design
 *
 * Uses class inheritance to override `.action()` and `.opts()` with typed
 * versions. This is the simplest approach that preserves all Commander
 * functionality:
 * - No runtime overhead — just method overrides
 * - No wrapper library to maintain — all Commander methods, options, and
 *   plugins work as normal
 * - Easy to remove if Commander adds native TypeScript support
 *
 * The `as T` cast is centralized inside the helper so callers never need to
 * cast manually. You define your options interface once at createTypedCommand()
 * and it flows through to .action(), .opts(), parseTypedCommand(), or
 * runTypedCommand() automatically.
 *
 * The `.argument()` guard uses a second type parameter (Args) tracked via a
 * phantom `_brand` property. This makes TypedCommand<T, 'has-positional-args'>
 * structurally distinct from TypedCommand<T, 'no-positional-args'>, so
 * TypeScript's `this` parameter on `.action()` can reject calls when positional
 * args are declared. The brand survives chaining through .option(), .name(), etc.
 *
 * ## Trade-offs
 *
 * - Options type is declared upfront, not inferred from .option() calls — if
 *   your interface doesn't match your .option() calls, TS won't catch it
 * - The .argument() override uses @ts-ignore because Commander's type requires
 *   returning `this`, but we need to return a narrowed type
 * - Positional args are always string[] — no per-argument type narrowing
 */

import { Command, OptionValues } from 'commander';

type ArgMode = 'no-positional-args' | 'has-positional-args';

class TypedCommand<
  T extends Record<string, any>,
  Args extends ArgMode = 'no-positional-args',
> extends Command {
  // Phantom property — makes Args structurally visible so TS can
  // distinguish TypedCommand<T, 'has-positional-args'> from
  // TypedCommand<T, 'no-positional-args'>.
  declare readonly _brand: Args;
  private _hasArgs = false;

  // @ts-ignore — intentionally narrowing return type to track argument usage
  argument(
    name: string,
    description?: string,
    defaultValue?: unknown,
  ): TypedCommand<T, 'has-positional-args'> {
    this._hasArgs = true;
    super.argument(name, description, defaultValue);
    return this as unknown as TypedCommand<T, 'has-positional-args'>;
  }

  // Defaults to T so callers get typed opts without specifying the generic.
  // Constraint must be OptionValues (not T) to match Commander's signature —
  // using `extends T` causes a TS override error.
  opts<U extends OptionValues = T>(): U {
    return super.opts() as U;
  }

  action(
    this: TypedCommand<T, 'no-positional-args'>,
    handler: (options: T, command: Command) => void | Promise<void>,
  ): this {
    if ((this as any)._hasArgs) {
      throw new Error(
        'TypedCommand: .action() does not support positional args. ' +
          'Use runTypedCommand() instead.',
      );
    }
    return super.action((options, cmd) => handler(options as T, cmd)) as this;
  }
}

function createTypedCommand<T extends Record<string, any>>() {
  return new TypedCommand<T, 'no-positional-args'>();
}

function parseTypedCommand<T extends Record<string, any>>(
  program: TypedCommand<T, ArgMode>,
): { opts: T; args: string[] } {
  program.parse();
  return { opts: program.opts(), args: program.args };
}

function runTypedCommand<T extends Record<string, any>>(
  program: TypedCommand<T, ArgMode>,
  handler: (opts: T, args: string[]) => void,
) {
  program.parse();
  handler(program.opts(), program.args);
}

export { createTypedCommand, parseTypedCommand, runTypedCommand };
