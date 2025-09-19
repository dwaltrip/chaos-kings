import { Command } from 'commander';
import { createTypedCommand } from './helpers/typed-command.js';

// Test interfaces
interface DatabaseOptions {
  env: string;
  dryRun?: boolean;
}

// Usage
const dbCommand = createTypedCommand<DatabaseOptions>()
  .name('database')
  .description('Database operations')
  .option('-e, --env <environment>', 'Environment', 'dev')
  .option('--dry-run', 'Show what would be done')
  .action((options) => {
    // Hover over 'options' - should show DatabaseOptions, not any
    console.log(options.env); // Should have autocomplete
    console.log(options.dryRun); // Should have autocomplete
  });

const program = new Command();

program
  .name('example-tool')
  .description('Example development tool using Commander.js')
  .version('1.0.0')
  .addCommand(dbCommand);

program.parse(process.argv);
