// Written with Claude
// Chat link: https://claude.ai/share/bb926dc9-366c-4598-8f26-28e34e5ec364

/**
 * Typed Command Wrapper for Commander.js
 * ========================================
 *
 * ## Problem
 *
 * Commander.js has excellent runtime functionality but presents a TypeScript challenge:
 * its fluent/builder API makes it impossible to infer option types in the `.action()`
 * callback. When you write:
 *
 * ```ts
 * program
 *   .option('-e, --env <env>', 'environment')
 *   .option('--force', 'force deployment')
 *   .action((options) => {
 *     // ❌ options is typed as 'any' - no autocomplete or type safety!
 *   })
 * ```
 *
 * The `options` parameter defaults to `any` because TypeScript can't statically analyze
 * the runtime chain of `.option()` calls to determine what properties will exist.
 *
 * ## Why This Happens
 *
 * Commander builds the options object dynamically at runtime based on which `.option()`
 * methods are called. TypeScript's static analysis happens at compile time, before any
 * code runs, so it cannot know what the shape of `options` will be. This is a fundamental
 * mismatch between Commander's fluent API design and TypeScript's type system.
 *
 * ## Solution Approach
 *
 * This helper uses class inheritance to override only the `.action()` method, providing
 * a typed version while preserving all other Commander functionality. By specifying the
 * expected options type upfront via generics, we can ensure type safety:
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
 *   .action((options) => {
 *     // ✅ options is typed as DeployOptions - full IntelliSense!
 *     console.log(options.env);   // autocomplete works
 *     console.log(options.force); // type-safe access
 *   })
 * ```
 *
 * ## Why This Design?
 *
 * We evaluated several approaches:
 *
 * 1. **Manual type assertion**: `action((options: MyOptions) => {})`
 *    - ❌ Repetitive and easy to forget
 *
 * 2. **Wrapper with Proxy**: Using JavaScript Proxy to intercept method calls
 *    - ❌ More complex, harder to debug, TypeScript has trouble tracking types through Proxies
 *
 * 3. **Complete wrapper library**: Creating a fully typed wrapper around Commander
 *    - ❌ Large maintenance burden, loses access to Commander's ecosystem
 *
 * 4. **Class inheritance** (this solution):
 *    - ✅ Simple and straightforward - just 5 lines of actual code
 *    - ✅ TypeScript understands inheritance perfectly
 *    - ✅ Preserves all Commander methods, options, and plugins
 *    - ✅ No runtime overhead - it's just a method override
 *    - ✅ Easy to remove if Commander adds native TypeScript support later
 *
 * ## Trade-offs
 *
 * - You must define your options interface upfront (actually a benefit for code clarity)
 * - The options type is not validated at runtime (Commander still does its normal parsing)
 * - If you define options that don't match your `.option()` calls, TypeScript won't catch it
 *
 * ## Usage Pattern
 *
 * 1. Define an interface for your command's options
 * 2. Create a typed command with `createTypedCommand<YourInterface>()`
 * 3. Chain your `.option()` calls as normal
 * 4. Your `.action()` callback receives typed options automatically
 *
 * This provides the best balance of type safety, simplicity, and compatibility with the
 * existing Commander.js ecosystem.
 */
import { Command } from 'commander';

class TypedCommand<T extends Record<string, any>> extends Command {
  action(
    handler: (options: T, command: Command) => void | Promise<void>,
  ): this {
    return super.action((options, cmd) => handler(options as T, cmd));
  }
}

function createTypedCommand<T extends Record<string, any>>() {
  return new TypedCommand<T>();
}

export { createTypedCommand };
