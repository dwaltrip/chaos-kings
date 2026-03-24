import path from 'path';
import { defineConfig } from 'vite';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@utils': path.resolve(__dirname, '../../packages/utils'),
      '@core': path.resolve(__dirname, '../../packages/core/src'),
      '@core-next': path.resolve(__dirname, '../../packages/algos/src/core-next'),
      '@algos': path.resolve(__dirname, '../../packages/algos/src'),
    },
  },
});
