import * as fs from 'fs';
import * as path from 'path';

// Reformat board .txt files in a directory to the new spaced middle-dot format.
// Usage: npx tsx src/perfect-start-solver/tmp-scripts/reformat-boards.ts <directory>
//
// Old format:  .G.MMM..   (packed chars, . = blank, M = mountain)
// New format:  · G · # # # · ·   (space-separated, · = blank, # = mountain)

const OLD_BLANK = '.';
const OLD_MOUNTAIN = 'M';
const NEW_BLANK = '·';
const NEW_MOUNTAIN = '#';

function isNewFormat(line: string): boolean {
  return line.includes(NEW_BLANK) || line.includes(NEW_MOUNTAIN);
}

function convertChar(ch: string): string {
  if (ch === OLD_BLANK) return NEW_BLANK;
  if (ch === OLD_MOUNTAIN) return NEW_MOUNTAIN;
  return ch; // G, etc.
}

function reformatFile(filepath: string): void {
  const text = fs.readFileSync(filepath, 'utf-8');
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    console.log(`  SKIP (empty): ${filepath}`);
    return;
  }

  if (isNewFormat(lines[0])) {
    console.log(`  SKIP (already new format): ${path.basename(filepath)}`);
    return;
  }

  // Validate: all rows must have the same length
  const width = lines[0].length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length !== width) {
      throw new Error(
        `Row length mismatch in ${filepath}: ` +
          `row 0 has ${width} cols, row ${i} has ${lines[i].length} cols`,
      );
    }
  }

  const newLines = lines.map((line) => {
    return line.split('').map(convertChar).join(' ');
  });

  const output = newLines.join('\n') + '\n';
  fs.writeFileSync(filepath, output, 'utf-8');
  console.log(`  DONE: ${path.basename(filepath)} (${lines.length}x${width})`);
}

function main(): void {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: npx tsx reformat-boards.ts <directory>');
    process.exit(1);
  }

  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    console.error(`Not a directory: ${resolved}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(resolved)
    .filter((f) => f.endsWith('.txt'))
    .sort();

  if (files.length === 0) {
    console.log('No .txt files found.');
    return;
  }

  console.log(`Reformatting ${files.length} board(s) in ${resolved}:\n`);

  for (const file of files) {
    reformatFile(path.join(resolved, file));
  }

  console.log('\nDone.');
}

main();
