import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { createTypedCommand } from './helpers/typed-command';

interface CommitRewriteEntry {
  hash: string;
  'new-message': string | string[];
}

interface CommitInfo {
  sha: string;
  shortSha: string;
  subject: string;
  body: string;
  author: {
    name: string;
    email: string;
    timestamp: string;
  };
}

interface RewriteResult {
  sha: string;
  success: boolean;
  newMessage?: string;
  error?: string;
}

interface CommandOptions {
  sourceBranch: string;
  outputBranch: string;
  rewriteFile: string;
  baseBranch: string;
  dryRun?: boolean;
  outputResults?: string;
}

class GitCommitRewriter {
  private dryRun: boolean;

  constructor(options: { dryRun?: boolean } = {}) {
    this.dryRun = options.dryRun || false;
  }

  private gitExec(command: string, options: { silent?: boolean } = {}): string {
    const fullCommand = `git ${command}`;

    if (
      this.dryRun &&
      (command.includes('cherry-pick') || command.includes('commit'))
    ) {
      console.log(chalk.yellow(`[DRY RUN] Would execute: ${fullCommand}`));
      return '';
    }

    try {
      return execSync(fullCommand, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
      })
        .toString()
        .trim();
    } catch (error: any) {
      error.gitCommand = fullCommand;
      throw error;
    }
  }

  private ensureCleanRepo(): void {
    const status = this.gitExec('status --porcelain', { silent: true });
    if (status) {
      throw new Error(
        'Working directory not clean.\n' +
          'Stash or commit changes:\n' +
          chalk.gray(status),
      );
    }

    const gitDir = this.gitExec('rev-parse --git-dir', { silent: true });
    const rebaseMergePath = path.join(gitDir, 'rebase-merge');
    const rebaseApplyPath = path.join(gitDir, 'rebase-apply');

    if (fs.existsSync(rebaseMergePath) || fs.existsSync(rebaseApplyPath)) {
      throw new Error('Rebase already in progress. Finish or abort it first.');
    }
  }

  private getCommitInfo(sha: string): CommitInfo {
    const format = [
      '%H', // full hash
      '%h', // short hash
      '%s', // subject
      '%b', // body
      '%an', // author name
      '%ae', // author email
      '%at', // author timestamp
    ].join('%x00'); // null separator

    const info = this.gitExec(`log -1 --format="${format}" ${sha}`, {
      silent: true,
    });
    const parts = info.split('\x00');

    return {
      sha: parts[0],
      shortSha: parts[1],
      subject: parts[2],
      body: parts[3],
      author: {
        name: parts[4],
        email: parts[5],
        timestamp: parts[6],
      },
    };
  }

  private formatCommitMessage(newMessage: string | string[]): string {
    if (typeof newMessage === 'string') {
      return newMessage;
    }

    if (!Array.isArray(newMessage)) {
      throw new Error(
        `new-message must be a string or array. Found: ${typeof newMessage}`,
      );
    }

    if (newMessage.length === 0) {
      throw new Error('new-message array cannot be empty');
    }

    // First element is subject, remaining are body lines
    const subject = newMessage[0];
    const bodyLines = newMessage.slice(1);

    if (bodyLines.length === 0) {
      return subject;
    }

    return `${subject}\n\n${bodyLines.join('\n')}`;
  }

  private rewriteCommitMessage(
    sha: string,
    commitInfo: CommitInfo,
    newMessage: string,
  ): void {
    // Write the new message to a temporary file to avoid shell injection
    const tempFile = path.join(process.cwd(), '.git', 'COMMIT_EDITMSG_TEMP');

    try {
      fs.writeFileSync(tempFile, newMessage, 'utf8');

      // Amend with new message from file, preserving authorship
      this.gitExec(
        `commit --amend --file="${tempFile}" --author="${commitInfo.author.name} <${commitInfo.author.email}>"`,
        { silent: true },
      );
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  private loadNewMessagesFromFile(filePath: string): Map<string, string> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Rewrite file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let data: CommitRewriteEntry[];

    try {
      data = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON in rewrite file: ${filePath}`);
    }

    if (!Array.isArray(data)) {
      throw new Error('Rewrite file must contain an array of objects');
    }

    const rewriteMap = new Map<string, string>();
    const seenHashes = new Set<string>();

    for (let i = 0; i < data.length; i++) {
      const item = data[i];

      // Validate required properties
      if (!item || typeof item !== 'object') {
        throw new Error(
          `Item ${i} must be an object. Found: ${JSON.stringify(item)}`,
        );
      }

      if (!item.hash || typeof item.hash !== 'string') {
        throw new Error(
          `Item ${i} must have a 'hash' property (string). Found: ${JSON.stringify(item)}`,
        );
      }

      if (!item['new-message']) {
        throw new Error(
          `Item ${i} must have a 'new-message' property. Found: ${JSON.stringify(item)}`,
        );
      }

      // Validate hash format (basic SHA pattern)
      if (!/^[a-f0-9]{7,40}$/i.test(item.hash)) {
        throw new Error(
          `Item ${i} has invalid hash format: ${item.hash}. Must be 7-40 hex characters.`,
        );
      }

      // Check for duplicate hashes
      if (seenHashes.has(item.hash)) {
        throw new Error(`Duplicate hash found: ${item.hash}`);
      }
      seenHashes.add(item.hash);

      // Format the new message
      const formattedMessage = this.formatCommitMessage(item['new-message']);
      rewriteMap.set(item.hash, formattedMessage);
    }

    return rewriteMap;
  }

  private validateHashesExist(
    hashes: Set<string>,
    baseBranch: string,
    sourceBranch: string,
  ): void {
    // Get all commits between base and source
    const commits = this.gitExec(`rev-list ${baseBranch}..${sourceBranch}`, {
      silent: true,
    })
      .split('\n')
      .filter(Boolean);

    const commitSet = new Set(commits);
    const missingHashes: string[] = [];

    for (const hash of hashes) {
      // Check if it's a full SHA or abbreviated
      let found = false;

      if (hash.length === 40) {
        // Full SHA
        found = commitSet.has(hash);
      } else {
        // Also try to resolve as an abbreviated SHA
        try {
          const fullSha = this.gitExec(`rev-parse ${hash}`, { silent: true });
          found = commitSet.has(fullSha);
        } catch {
          found = false;
        }
      }

      if (!found) {
        missingHashes.push(hash);
      }
    }

    if (missingHashes.length > 0) {
      throw new Error(
        `The following hashes do not exist between ${baseBranch} and ${sourceBranch}:\n` +
          missingHashes.map((h) => `  - ${h}`).join('\n'),
      );
    }
  }

  async rewriteCommitMessages(
    sourceBranch: string,
    outputBranch: string,
    newMessagesFilepath: string,
    baseBranch: string = 'dev',
  ): Promise<RewriteResult[]> {
    console.log(chalk.blue('🚀 Starting commit rewrite process'));

    const rewriteMap = this.loadNewMessagesFromFile(newMessagesFilepath);
    console.log(
      chalk.gray(
        `Loaded ${rewriteMap.size} rewrites from ${newMessagesFilepath}`,
      ),
    );

    this.ensureCleanRepo();

    // Check branches exist
    try {
      this.gitExec(`rev-parse ${sourceBranch}`, { silent: true });
      this.gitExec(`rev-parse ${baseBranch}`, { silent: true });
    } catch (error: any) {
      throw new Error(`Branch not found: ${error.gitCommand}`);
    }

    // Check that ouptut branch doesn't exist
    try {
      this.gitExec(`rev-parse ${outputBranch}`, { silent: true });
      throw new Error(
        `Branch ${outputBranch} already exists. Delete it first or choose a different name.`,
      );
    } catch (error: any) {
      // Good, branch doesn't exist (or we just threw above)
      if (error.message?.includes('already exists')) {
        throw error;
      }
    }

    // Validate all hashes exist in the commit range
    console.log(chalk.gray('Validating all hashes exist in commit range...'));
    this.validateHashesExist(
      new Set(rewriteMap.keys()),
      baseBranch,
      sourceBranch,
    );
    console.log(chalk.green('✓ All hashes validated'));

    // Get list of commits
    const commits = this.gitExec(
      `rev-list --reverse ${baseBranch}..${sourceBranch}`,
      { silent: true },
    )
      .split('\n')
      .filter(Boolean);

    if (commits.length === 0) {
      throw new Error(
        `No commits found between ${baseBranch} and ${sourceBranch}`,
      );
    }

    console.log(chalk.gray(`Found ${commits.length} commits to process`));

    // Create new branch
    this.gitExec(`checkout -b ${outputBranch} ${baseBranch}`, { silent: true });
    console.log(chalk.green(`✓ Created branch ${outputBranch}`));

    // Process each commit
    const results: RewriteResult[] = [];
    let successCount = 0;

    for (let i = 0; i < commits.length; i++) {
      const sha = commits[i];
      const info = this.getCommitInfo(sha);
      const progress = `[${i + 1}/${commits.length}]`;

      try {
        // Cherry-pick the commit
        this.gitExec(`cherry-pick ${sha}`, { silent: true });

        // Check if we need to rewrite message
        // Check full SHA and short SHA
        const newMessage = rewriteMap.get(sha) || rewriteMap.get(info.shortSha);

        if (newMessage) {
          // Rewrite the commit message (completely replaces original)
          this.rewriteCommitMessage(sha, info, newMessage);

          console.log(
            chalk.yellow(
              `${progress} ✏️ ${info.shortSha}: "${info.subject}" → "${newMessage.split('\n')[0]}"`,
            ),
          );
        } else {
          console.log(
            chalk.gray(
              `${progress} ✓ ${info.shortSha}: "${info.subject} (no change)"`,
            ),
          );
        }

        successCount++;
        results.push({ sha, success: true, newMessage });
      } catch (error: any) {
        console.error(
          chalk.red(
            `${progress} ✗ Failed to cherry-pick ${info.shortSha}: ${error.message}`,
          ),
        );

        results.push({ sha, success: false, error: error.message });

        // Abort the failed cherry-pick
        try {
          this.gitExec('cherry-pick --abort', { silent: true });
          console.log(chalk.gray(`  Aborted cherry-pick for ${info.shortSha}`));
        } catch (abortError: any) {
          console.warn(
            chalk.yellow(
              `  Warning: Could not abort cherry-pick: ${abortError.message}`,
            ),
          );
        }

        // Stop on any error to prevent corrupting the rewrite process
        throw new Error(`Stopped at commit ${info.shortSha}`);
      }
    }

    // Summary
    console.log('\n' + chalk.blue('📊 Summary:'));
    console.log(
      chalk.green(`  ✓ ${successCount} commits processed successfully`),
    );
    if (results.some((r) => !r.success)) {
      console.log(
        chalk.red(
          `  ✗ ${results.filter((r) => !r.success).length} commits failed`,
        ),
      );
    }

    // Offer to compare branches
    if (successCount === commits.length) {
      console.log(
        '\n' +
          chalk.gray(
            'Compare with: git diff ' + sourceBranch + ' ' + outputBranch,
          ),
      );
      console.log(
        chalk.gray(
          'If happy: git branch -D ' +
            sourceBranch +
            ' && git branch -m ' +
            outputBranch +
            ' ' +
            sourceBranch,
        ),
      );
    }

    return results;
  }
}

// Main execution
async function main() {
  const program = createTypedCommand<CommandOptions>()
    .name('rewrite-commit-messages')
    .description(
      'Rewrite commit messages for a selection of commits on a branch',
    )
    .requiredOption('-s, --source-branch <branch>', 'source branch to rewrite')
    .requiredOption(
      '-o, --output-branch <branch>',
      'output branch name (must not exist)',
    )
    .requiredOption(
      '-f, --rewrite-file <file>',
      'JSON file containing commit rewrites',
    )
    .option('-b, --base-branch <branch>', 'base branch', 'dev')
    .option('--dry-run', 'show what would be done without making changes')
    .option(
      '-r, --output-results <file>',
      'results output file',
      'rewrite-results.json',
    )
    .addHelpText(
      'after',
      `
Examples:
  $ npx tsx rewrite-commit-messages.ts -s my-branch -o my-branch-v2 -f rewrites.json
  $ npx tsx rewrite-commit-messages.ts -s feat-123 -o feat-123-v2 -f rewrites.json -b main --dry-run

Rewrite file format:
[
  {
    "hash": "abc1234",
    "new-message": ["feat: new subject", "body line 1", "body line 2"]
  },
  {
    "hash": "def5678",
    "new-message": "fix: simple subject only"
  }
]
`,
    )
    .action(async (options) => {
      const rewriter = new GitCommitRewriter({
        dryRun: options.dryRun,
      });

      try {
        const results = await rewriter.rewriteCommitMessages(
          options.sourceBranch,
          options.outputBranch,
          options.rewriteFile,
          options.baseBranch,
        );

        // Save results for inspection
        fs.writeFileSync(
          options.outputResults,
          JSON.stringify(results, null, 2),
        );
        console.log(chalk.gray(`\nResults saved to ${options.outputResults}`));
      } catch (error: any) {
        console.error(chalk.red('Fatal error:'), error.message);
        process.exit(1);
      }
    });

  await program.parseAsync();
}

// Run if this is the main module
if (require.main === module) {
  main();
}
