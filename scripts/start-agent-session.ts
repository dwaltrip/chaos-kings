#!/usr/bin/env tsx
import { createInterface } from 'readline';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execSync, spawn } from 'child_process';
import chalk from 'chalk';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function findEpics(): Array<{ path: string; name: string }> {
  const epicsDir = join(process.cwd(), 'epics');
  const years = readdirSync(epicsDir).filter((name) => {
    const fullPath = join(epicsDir, name);
    return statSync(fullPath).isDirectory();
  });

  const epics: Array<{ path: string; name: string }> = [];

  for (const year of years) {
    const yearPath = join(epicsDir, year);
    const months = readdirSync(yearPath).filter((name) => {
      const fullPath = join(yearPath, name);
      return statSync(fullPath).isDirectory();
    });

    for (const epicDir of months) {
      const epicPath = join('epics', year, epicDir);
      epics.push({
        path: epicPath,
        name: `${year}/${epicDir}`,
      });
    }
  }

  return epics.reverse(); // Most recent first
}

async function main() {
  console.log(chalk.bold.cyan('\n=== Start Epic Session ===\n'));

  // Find and display epics
  const epics = findEpics();

  if (epics.length === 0) {
    console.log(chalk.red('No epics found!'));
    rl.close();
    return;
  }

  console.log(chalk.bold('Available epics:\n'));
  epics.forEach((epic, index) => {
    console.log(chalk.gray(`[${index + 1}]`) + ` ${epic.name}`);
  });

  console.log();

  // Get epic selection
  const epicChoice = await question(chalk.bold('Select an epic (enter number): '));
  const epicIndex = parseInt(epicChoice, 10) - 1;

  if (isNaN(epicIndex) || epicIndex < 0 || epicIndex >= epics.length) {
    console.log(chalk.red('\nInvalid selection!'));
    rl.close();
    return;
  }

  const selectedEpic = epics[epicIndex];
  console.log(chalk.green(`✓ Selected: ${selectedEpic.name}\n`));

  // Get session goal
  const goal = await question(chalk.bold('What do you want to work on?\n> '));

  if (!goal.trim()) {
    console.log(chalk.red('\nSession goal is required!'));
    rl.close();
    return;
  }

  // Get optional context
  console.log();
  const context = await question(
    chalk.gray('Any additional context? (press Enter to skip)\n> '),
  );

  // Generate prompt
  let prompt = `Current Epic: ${selectedEpic.name.split('/').pop()}

Docs: ${selectedEpic.path}/

Quick context check:
- Current status: @${selectedEpic.path}/[STATUS].md
- Active TODOs: @${selectedEpic.path}/[TODOS].md

Session Goal: ${goal.trim()}`;

  if (context.trim()) {
    prompt += `\n\nAdditional Context: ${context.trim()}`;
  }

  prompt += `\n\nBefore starting work, please briefly confirm your understanding of the goal and outline your first steps. Don't immediately dive into implementation.`;

  // Add script attribution
  prompt += `\n\n---\n_Generated via: \`npm run agent\`_`;

  // Ask how to proceed
  console.log();
  const action = await question(chalk.bold('Start Claude Code session now? (Y/n): '));

  if (action.toLowerCase() === 'n') {
    // Copy to clipboard only
    try {
      execSync('pbcopy', { input: prompt });
      console.log(chalk.green('\n✅ Prompt copied to clipboard!\n'));
    } catch (err) {
      console.log(chalk.yellow('\n⚠️  Could not copy to clipboard\n'));
    }

    console.log(chalk.gray('─────────────────────────────────────'));
    console.log(prompt);
    console.log(chalk.gray('─────────────────────────────────────'));
    console.log(chalk.dim('\nPaste into Claude Code to start your session.\n'));
  } else {
    // Start Claude Code session
    console.log(chalk.cyan('\n🚀 Starting Claude Code session...\n'));
    rl.close();

    const claude = spawn('claude', [prompt], {
      stdio: 'inherit',
    });

    claude.on('error', (err) => {
      console.log(chalk.red('\n❌ Failed to start Claude Code session'));
      console.log(chalk.yellow('Copying prompt to clipboard instead...\n'));

      try {
        execSync('pbcopy', { input: prompt });
        console.log(chalk.green('✅ Prompt copied to clipboard!\n'));
      } catch {
        console.log(chalk.gray('─────────────────────────────────────'));
        console.log(prompt);
        console.log(chalk.gray('─────────────────────────────────────'));
      }
    });

    claude.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.log(chalk.yellow(`\nClaude Code exited with code ${code}\n`));
      }
    });
  }

  if (action.toLowerCase() === 'n') {
    rl.close();
  }
}

main();
