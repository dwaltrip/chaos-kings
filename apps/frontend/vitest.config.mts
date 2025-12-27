import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@utils': path.resolve(__dirname, '../../packages/utils'),
      '@kernel': path.resolve(__dirname, '../../packages/kernel'),
      '@protocol': path.resolve(__dirname, '../../packages/protocol'),
      '@platform': path.resolve(__dirname, '../../packages/platform'),
      '@core': path.resolve(__dirname, '../../packages/core/src'),
    },
  },
  test: {
    globals: true,
  },
});
