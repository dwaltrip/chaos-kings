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
    const tsFiles = execSync('find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v node_modules | grep -v package-lock.json | wc -l', { encoding: 'utf8' }).trim();
    const totalLines = execSync('find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v node_modules | grep -v package-lock.json | xargs wc -l | tail -1 | awk "{print \\$1}"', { encoding: 'utf8' }).trim();
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

function getLinesOfCodeOverTime() {
  try {
    // Get commits from the past 2 weeks, sampling every 2-3 days
    const commits = execSync('git log --since="2 weeks ago" --format="%H %cd" --date=short | awk \'NR%3==1\'', { encoding: 'utf8' }).trim();
    
    if (!commits) return [];
    
    const commitLines = commits.split('\n').slice(0, 7); // Max 7 data points
    const locData = [];
    
    for (const line of commitLines) {
      const [hash, date] = line.split(' ');
      try {
        // Count lines at this specific commit
        const linesCmd = `git show ${hash} --name-only --format="" | grep -E "\\.(ts|tsx|js|jsx)$" | grep -v node_modules | grep -v package-lock.json | xargs -I {} git show ${hash}:{} 2>/dev/null | wc -l`;
        const lines = execSync(linesCmd, { encoding: 'utf8' }).trim();
        locData.push({ date, lines: parseInt(lines) || 0 });
      } catch (err) {
        // Skip commits where we can't count lines
        continue;
      }
    }
    
    return locData.reverse(); // Chronological order
  } catch (error) {
    return [];
  }
}

function createSparkline(data, width = 20) {
  if (data.length < 2) return '━'.repeat(width);
  
  const values = data.map(d => d.lines);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  // Unicode block elements for sparkline
  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  
  let sparkline = '';
  for (let i = 0; i < width; i++) {
    const index = Math.floor((i / width) * data.length);
    const value = values[index] || values[values.length - 1];
    const normalized = (value - min) / range;
    const charIndex = Math.floor(normalized * (chars.length - 1));
    sparkline += chars[charIndex];
  }
  
  return sparkline;
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
const locOverTime = getLinesOfCodeOverTime();

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

// LOC Trend
if (locOverTime.length > 1) {
  console.log(colorize('📈 LINES OF CODE TREND (2 weeks)', colors.bright + colors.cyan));
  console.log('━'.repeat(50));
  const sparkline = createSparkline(locOverTime, 30);
  const startLoc = locOverTime[0]?.lines || 0;
  const endLoc = locOverTime[locOverTime.length - 1]?.lines || 0;
  const change = endLoc - startLoc;
  const changeStr = change >= 0 ? `+${change}` : change.toString();
  const changeColor = change >= 0 ? colors.green : colors.red;
  
  console.log(`📊 Trend:                 ${colorize(sparkline, colors.bright + colors.green)}`);
  console.log(`📈 Growth:                ${colorize(changeStr, colors.bright + changeColor)} lines (${startLoc.toLocaleString()} → ${endLoc.toLocaleString()})`);
  console.log();
}

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