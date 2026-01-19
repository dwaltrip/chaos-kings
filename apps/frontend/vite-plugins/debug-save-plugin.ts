import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

const DEBUG_DIR = '.debug';

function debugSavePlugin(): Plugin {
  return {
    name: 'debug-save',
    apply: 'serve', // Only in dev mode

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/__debug_save' || req.method !== 'POST') {
          return next();
        }

        let body = '';

        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const data = JSON.parse(body);

            // Ensure directory exists
            const debugDir = path.resolve(process.cwd(), DEBUG_DIR);
            if (!fs.existsSync(debugDir)) {
              fs.mkdirSync(debugDir, { recursive: true });
            }

            // Build filename: sessionId or sessionId-saveName
            const sessionId = data.sessionId || `debug-${Date.now()}`;
            const saveName = data.saveName;
            const filename = saveName
              ? `${sessionId}-${saveName}.json`
              : `${sessionId}.json`;

            // Remove saveName from output (not needed in the file)
            delete data.saveName;

            // Write file
            const filePath = path.join(debugDir, filename);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

            // Return relative path for cleaner logging
            const relativePath = `.debug/${filename}`;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, path: relativePath }));
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: message }));
          }
        });

        req.on('error', (err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        });
      });
    },
  };
}

export { debugSavePlugin };
