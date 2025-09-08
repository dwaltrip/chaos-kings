#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Target modules to analyze
const TARGET_MODULES = ['backend', 'common', 'core', 'frontend'];

/**
 * Check if a file should be excluded
 */
function shouldExcludeFile(filePath) {
  // Exclude test files
  if (filePath.includes('.test.') || filePath.includes('.spec.')) {
    return true;
  }

  // Exclude node_modules
  if (filePath.includes('node_modules')) {
    return true;
  }

  if (filePath.includes('_misc')) {
    return true;
  }

  return false;
}

/**
 * Count meaningful lines in a TypeScript file
 * Excludes empty lines and comment-only lines
 */
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    let count = 0;
    let inMultilineComment = false;

    for (let line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (trimmed === '') continue;

      // Handle multiline comments
      if (trimmed.includes('/*') && !trimmed.includes('*/')) {
        inMultilineComment = true;
        // Check if there's code before the comment start
        const beforeComment = trimmed
          .substring(0, trimmed.indexOf('/*'))
          .trim();
        if (beforeComment) count++;
        continue;
      }

      if (inMultilineComment) {
        if (trimmed.includes('*/')) {
          inMultilineComment = false;
          // Check if there's code after the comment end
          const afterComment = trimmed
            .substring(trimmed.indexOf('*/') + 2)
            .trim();
          if (afterComment) count++;
        }
        continue;
      }

      // Skip single-line comments
      if (trimmed.startsWith('//')) continue;

      // Skip multiline comments on single line
      if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) continue;

      count++;
    }

    return count;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * Find all TypeScript files in a directory
 */
function findTsFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && entry.name !== 'node_modules') {
      findTsFiles(fullPath, files);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
    ) {
      if (!shouldExcludeFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Get relative path from project root
 */
function getRelativePath(filePath) {
  return path.relative(process.cwd(), filePath);
}

/**
 * Group files by top-level module
 */
function groupFilesByModule(files) {
  const grouped = {};

  // Initialize all target modules
  TARGET_MODULES.forEach((module) => {
    grouped[module] = [];
  });

  files.forEach((file) => {
    const relativePath = getRelativePath(file);
    const topLevelDir = relativePath.split(path.sep)[0];

    if (TARGET_MODULES.includes(topLevelDir)) {
      const lineCount = countLines(file);
      grouped[topLevelDir].push({
        path: relativePath,
        lines: lineCount,
      });
    }
  });

  // Sort files within each module by line count (descending)
  Object.keys(grouped).forEach((module) => {
    grouped[module].sort((a, b) => b.lines - a.lines);
  });

  return grouped;
}

/**
 * Main function
 */
function main() {
  console.log(
    `${colors.bright}${colors.cyan}TypeScript Code Line Counter${colors.reset}\n`,
  );

  // Find all TypeScript files
  const allFiles = [];
  TARGET_MODULES.forEach((module) => {
    const modulePath = path.join(process.cwd(), module);
    findTsFiles(modulePath, allFiles);
  });

  // Group files by module
  const groupedFiles = groupFilesByModule(allFiles);

  // Calculate totals
  let grandTotal = 0;
  const moduleTotals = {};
  const moduleCounts = {};

  Object.keys(groupedFiles).forEach((module) => {
    const moduleFiles = groupedFiles[module];
    const moduleTotal = moduleFiles.reduce((sum, file) => sum + file.lines, 0);
    moduleTotals[module] = moduleTotal;
    moduleCounts[module] = moduleFiles.length;
    grandTotal += moduleTotal;
  });

  const totalFiles = Object.values(moduleCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  // Display summary
  console.log(`${colors.bright}Summary:${colors.reset}`);
  console.log(
    `${colors.green}Grand Total: ${grandTotal.toLocaleString()} lines (${totalFiles} files)${colors.reset}\n`,
  );

  TARGET_MODULES.forEach((module) => {
    const total = moduleTotals[module];
    const count = moduleCounts[module];
    const percentage =
      grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) : '0.0';
    console.log(
      `${colors.yellow}${module.padEnd(10)}:`,
      `${total.toLocaleString().padStart(6)} lines`,
      `(${count.toString().padStart(2)} files)`,
      `- ${percentage}%${colors.reset}`,
    );
  });

  console.log('\n' + '='.repeat(60) + '\n');

  // Display detailed breakdown
  console.log(`${colors.bright}Detailed Breakdown:${colors.reset}\n`);

  TARGET_MODULES.forEach((module) => {
    const files = groupedFiles[module];
    if (files.length === 0) return;

    console.log(
      `${colors.bright}${colors.blue}${module.toUpperCase()}:${colors.reset}`,
    );
    files.forEach((file) => {
      const lineStr = file.lines.toLocaleString().padStart(4);
      console.log(
        `  ${colors.cyan}${lineStr}${colors.reset} lines - ${file.path}`,
      );
    });
    console.log('');
  });
}

if (require.main === module) {
  main();
}
