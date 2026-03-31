import * as fs from 'fs';
import { execSync } from 'child_process';

// Write JSON to a file, formatted with fjson (fractured json) for compact output.
// Writes raw JSON first, then runs fjson in-place to reformat.
// Falls back to raw JSON if fjson is not available or fails.
function writeJson(filePath: string, data: unknown): void {
  const raw = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, raw);
  try {
    execSync(`fjson -i 2 ${filePath} -o ${filePath}`);
  } catch {
    // fjson failed or not installed — raw JSON already on disk
  }
}

export { writeJson };
