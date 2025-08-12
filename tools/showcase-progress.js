#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bg_blue: '\x1b[44m',
  bg_green: '\x1b[42m'
};

function colorize(text, color) {
  return `${color}${text}${colors.reset}`;
}

function box(text, color = colors.cyan) {
  const len = text.length;
  const top = `╭${'─'.repeat(len + 2)}╮`;
  const mid = `│ ${colorize(text, color)} │`;
  const bot = `╰${'─'.repeat(len + 2)}╯`;
  return `${top}\n${mid}\n${bot}`;
}

function getGitStats() {
  try {
    const commits2weeks = execSync('git log --oneline --since="2 weeks ago" | wc -l', { encoding: 'utf8' }).trim();
    const commits1week = execSync('git log --oneline --since="1 week ago" | wc -l', { encoding: 'utf8' }).trim();
    const filesChanged = execSync('git log --since="2 weeks ago" --stat --pretty=format:"" | grep "files changed" | wc -l', { encoding: 'utf8' }).trim();
    const totalInsertions = execSync('git log --since="2 weeks ago" --stat --pretty=format:"" | grep -o "[0-9]\\+ insertion" | sed "s/ insertion//" | awk "{sum+=\\$1} END {print sum}"', { encoding: 'utf8' }).trim() || '0';
    
    return {
      commits2weeks: parseInt(commits2weeks),
      commits1week: parseInt(commits1week),
      filesChanged: parseInt(filesChanged),
      insertions: parseInt(totalInsertions)
    };
  } catch (error) {
    return { commits2weeks: 0, commits1week: 0, filesChanged: 0, insertions: 0 };
  }
}

function getCodeStats() {
  try {
    const tsFiles = execSync('find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v node_modules | wc -l', { encoding: 'utf8' }).trim();
    const totalLines = execSync('find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v node_modules | xargs wc -l | tail -1 | awk "{print \\$1}"', { encoding: 'utf8' }).trim();
    const testFiles = execSync('find . -name "*.test.ts" -o -name "*.test.tsx" | grep -v node_modules | wc -l', { encoding: 'utf8' }).trim();
    
    return {
      files: parseInt(tsFiles),
      lines: parseInt(totalLines),
      tests: parseInt(testFiles)
    };
  } catch (error) {
    return { files: 0, lines: 0, tests: 0 };
  }
}

function getRecentCommits() {
  try {
    const commits = execSync('git log --oneline --since="1 week ago" | head -8', { encoding: 'utf8' });
    return commits.split('\n').filter(line => line.trim()).slice(0, 6);
  } catch (error) {
    return [];
  }
}

function createProgressBar(value, max, width = 30) {
  const percentage = Math.min(value / max, 1);
  const filled = Math.floor(percentage * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `${colorize(bar, colors.green)} ${Math.round(percentage * 100)}%`;
}

console.log();
console.log(colorize('╔══════════════════════════════════════════════════════════════╗', colors.bright + colors.cyan));
console.log(colorize('║              🚀 GENERALS V2 PROGRESS REPORT 🚀              ║', colors.bright + colors.yellow));
console.log(colorize('║                  Daniel\'s 2-Week Beast Mode                 ║', colors.bright + colors.white));
console.log(colorize('╚══════════════════════════════════════════════════════════════╝', colors.bright + colors.cyan));
console.log();

const gitStats = getGitStats();
const codeStats = getCodeStats();
const recentCommits = getRecentCommits();

// Git Velocity Section
console.log(colorize('📊 DEVELOPMENT VELOCITY', colors.bright + colors.blue));
console.log('━'.repeat(50));
console.log(`🔥 Commits (2 weeks):     ${colorize(gitStats.commits2weeks.toString(), colors.bright + colors.green)}`);
console.log(`⚡ Commits (1 week):      ${colorize(gitStats.commits1week.toString(), colors.bright + colors.yellow)}`);
console.log(`📝 Code insertions:       ${colorize(`+${gitStats.insertions}`, colors.bright + colors.green)}`);
console.log(`📁 Files modified:        ${colorize(gitStats.filesChanged.toString(), colors.cyan)}`);
console.log();

// Architecture Overview
console.log(colorize('🏗️  FULL-STACK ARCHITECTURE', colors.bright + colors.magenta));
console.log('━'.repeat(50));
console.log(`${colorize('Backend', colors.green)}     │ Node.js + TypeScript + PostgreSQL + Redis`);
console.log(`${colorize('Frontend', colors.blue)}    │ React 19 + TypeScript + Vite + Tailwind`);
console.log(`${colorize('Core', colors.yellow)}       │ Pure game logic + Jest testing`);
console.log(`${colorize('Common', colors.cyan)}      │ Shared types + validation + utilities`);
console.log(`${colorize('WebSocket', colors.red)}    │ Real-time multiplayer infrastructure`);
console.log();

// Code Metrics
console.log(colorize('📈 CODE METRICS', colors.bright + colors.green));
console.log('━'.repeat(50));
console.log(`📄 TypeScript files:      ${colorize(codeStats.files.toString(), colors.bright + colors.white)}`);
console.log(`📏 Lines of code:         ${colorize(codeStats.lines.toLocaleString(), colors.bright + colors.white)}`);
console.log(`🧪 Test files:            ${colorize(codeStats.tests.toString(), colors.bright + colors.white)}`);
console.log(`📊 Productivity:          ${createProgressBar(gitStats.commits2weeks, 120)}`);
console.log();

// Features Implemented
console.log(colorize('🎮 MAJOR FEATURES IMPLEMENTED', colors.bright + colors.yellow));
console.log('━'.repeat(50));
console.log(`${colorize('✅', colors.green)} User Authentication & Session Management`);
console.log(`${colorize('✅', colors.green)} Real-time Matchmaking System`);
console.log(`${colorize('✅', colors.green)} Complete Gameplay Engine + Movement Logic`);
console.log(`${colorize('✅', colors.green)} WebSocket-based Multiplayer Infrastructure`);
console.log(`${colorize('✅', colors.green)} In-game Chat System`);
console.log(`${colorize('✅', colors.green)} Game State Management + UI Integration`);
console.log(`${colorize('✅', colors.green)} Database Layer + Migrations`);
console.log();

// Recent Achievements
console.log(colorize('🏆 RECENT ACHIEVEMENTS', colors.bright + colors.red));
console.log('━'.repeat(50));
recentCommits.forEach((commit, i) => {
  const [hash, ...msgParts] = commit.split(' ');
  const msg = msgParts.join(' ');
  const emoji = i === 0 ? '🔥' : i === 1 ? '⚡' : i === 2 ? '🚀' : '✨';
  console.log(`${emoji} ${colorize(msg.substring(0, 55), colors.white)}`);
});
console.log();

// Footer
console.log(colorize('┌─────────────────────────────────────────────────────────────┐', colors.cyan));
console.log(colorize('│  🎯 RESULT: Fully functional multiplayer real-time game!   │', colors.bright + colors.green));
console.log(colorize('│  💪 STATUS: Ready to crush more features!                  │', colors.bright + colors.yellow));
console.log(colorize('└─────────────────────────────────────────────────────────────┘', colors.cyan));
console.log();
console.log(colorize('Built with determination and lots of coffee ☕', colors.magenta));
console.log();