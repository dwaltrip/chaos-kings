#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';

interface TestCommit {
  message: string;
  author?: string;
  email?: string;
}

const testCommits: TestCommit[] = [
  { message: 'feat: add user authentication' },
  {
    message:
      'fix: resolve login bug\n\nThis fixes an issue where users could not log in\nwhen their email contained special characters.',
  },
  {
    message: 'docs: update README',
    author: 'Jane Doe',
    email: 'jane@example.com',
  },
  {
    message:
      'refactor: clean up utility functions\n\nRemoved unused functions\nImproved naming consistency',
  },
  { message: 'test: add integration tests' },
];

function gitExec(command: string): string {
  try {
    return execSync(`git ${command}`, { encoding: 'utf8' }).toString().trim();
  } catch (error: any) {
    throw new Error(`Git command failed: git ${command}\n${error.message}`);
  }
}

function createTestBranch(): string[] {
  const testBranchName = 'test-rewrite-branch';
  const currentBranch = gitExec('branch --show-current');

  console.log(chalk.blue('🔧 Creating test branch with dummy commits...'));

  // Check if test branch already exists and delete it
  try {
    gitExec(`rev-parse ${testBranchName}`);
    console.log(chalk.yellow(`Deleting existing ${testBranchName}...`));
    gitExec(`branch -D ${testBranchName}`);
  } catch {
    console.log(
      chalk.gray(`No existing ${testBranchName} branch found, so continuing.`),
    );
    // Branch doesn't exist, which is good
  }

  // Create test branch from current HEAD
  gitExec(`checkout -b ${testBranchName}`);
  console.log(chalk.green(`✓ Created branch ${testBranchName}`));

  const commitShas: string[] = [];

  // Create dummy commits
  for (let i = 0; i < testCommits.length; i++) {
    const commit = testCommits[i];
    const fileName = `test-file-${i + 1}.txt`;
    const content = `This is test file ${i + 1}\nCreated for commit: ${commit.message.split('\n')[0]}\nTimestamp: ${new Date().toISOString()}`;

    // Create/modify a file
    fs.writeFileSync(fileName, content);
    gitExec(`add ${fileName}`);

    // Set author if specified
    let authorFlag = '';
    if (commit.author && commit.email) {
      authorFlag = `--author="${commit.author} <${commit.email}>"`;
    }

    // Commit with message
    const tempFile = '.git/COMMIT_EDITMSG_TEMP';
    fs.writeFileSync(tempFile, commit.message);
    gitExec(`commit --file="${tempFile}" ${authorFlag}`);
    fs.unlinkSync(tempFile);

    // Get the commit SHA
    const sha = gitExec('rev-parse HEAD');
    commitShas.push(sha);

    console.log(
      chalk.gray(
        `  ✓ Created commit ${sha.substring(0, 7)}: ${commit.message.split('\n')[0]}`,
      ),
    );
  }

  // Switch back to original branch
  gitExec(`checkout ${currentBranch}`);
  console.log(chalk.green(`✓ Switched back to ${currentBranch}`));

  console.log(chalk.blue('\n📋 Test setup complete!'));
  console.log(chalk.gray(`Test branch: ${testBranchName}`));
  console.log(chalk.gray(`Created ${commitShas.length} test commits`));

  return commitShas;
}

function createTestRewriteFile(commitShas: string[]): void {
  const rewriteFile = 'tmp/test-rewrites.json';

  const rewrites = [
    {
      hash: commitShas[0].substring(0, 7), // short SHA
      'new-message': [
        'feat: implement comprehensive user auth system',
        'Add OAuth2 integration',
        'Add JWT token handling',
        'Add role-based permissions',
      ],
    },
    {
      hash: commitShas[2], // full SHA
      'new-message': 'docs: comprehensive README update',
    },
    {
      hash: commitShas[4].substring(0, 7),
      'new-message': [
        'test: comprehensive test suite',
        'Add unit tests',
        'Add integration tests',
        'Add e2e tests',
        '',
        'Coverage increased to 95%',
      ],
    },
  ];

  fs.writeFileSync(rewriteFile, JSON.stringify(rewrites, null, 2));
  console.log(chalk.green(`✓ Created test rewrite file: ${rewriteFile}`));

  console.log(chalk.blue('\n🧪 To test the rewrite script:'));
  console.log(chalk.gray(`npx tsx scripts/rewrite-commit-messages.ts \\`));
  console.log(chalk.gray(`  -s test-rewrite-branch \\`));
  console.log(chalk.gray(`  -o test-rewrite-branch-v2 \\`));
  console.log(chalk.gray(`  -f ${rewriteFile} \\`));
  console.log(chalk.gray(`  --dry-run`));

  console.log(chalk.blue('\n🧹 To cleanup when done:'));
  console.log(
    chalk.gray(`git branch -D test-rewrite-branch test-rewrite-branch-v2`),
  );
  console.log(
    chalk.gray(`rm ${rewriteFile} test-file-*.txt rewrite-results.json`),
  );
}

async function main() {
  try {
    // Ensure clean working directory
    const status = gitExec('status --porcelain');
    if (status) {
      console.error(
        chalk.red(
          'Working directory not clean. Please commit or stash changes first.',
        ),
      );
      process.exit(1);
    }

    const commitShas = createTestBranch();
    createTestRewriteFile(commitShas);
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
