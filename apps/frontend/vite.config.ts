import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@kernel': path.resolve(__dirname, '../../packages/kernel'),
      '@protocol': path.resolve(__dirname, '../../packages/protocol'),
      '@platform': path.resolve(__dirname, '../../packages/platform'),
      '@common': path.resolve(__dirname, '../../packages/common'),
      '@core': path.resolve(__dirname, '../../packages/core/src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3131',
      '/ws': {
        target: 'http://localhost:3131',
        ws: true,
      },
    },
  },
});
