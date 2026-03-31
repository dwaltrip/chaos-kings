import * as fs from 'fs';
import { execSync } from 'child_process';

// Write JSON to a file, formatted with fjson (fractured json) for compact output.
// Falls back to standard JSON.stringify if fjson is not available.
function writeJson(filePath: string, data: unknown): void {
  const raw = JSON.stringify(data, null, 2) + '\n';
  try {
    const compact = execSync('fjson -i 2', { input: raw, encoding: 'utf-8' });
    fs.writeFileSync(filePath, compact);
  } catch {
    fs.writeFileSync(filePath, raw);
  }
}

export { writeJson };
