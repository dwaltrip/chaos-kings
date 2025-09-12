import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Path mapping to resolve @common and @core imports
  paths: {
    '@common/*': ['common/*'],
    '@core/*': ['core/src/*'],
  },
  workspaces: {
    '.': {
      ignoreBinaries: ['husky'],
    },
    backend: {
      entry: [
        'src/server.ts',
        'scripts/**/*.ts',
        'migrations/**/*.ts',
        'seeds/**/*.ts',
      ],
      project: [
        'src/**/*.ts',
        'scripts/**/*.ts',
        'migrations/**/*.ts',
        'seeds/**/*.ts',
        '../common/**/*.ts',
        '../core/src/**/*.ts',
      ],
      paths: {
        '@common/*': ['../common/*'],
        '@core/*': ['../core/src/*'],
      },
      ignore: ['dist/**', 'node_modules/**'],
      ignoreBinaries: ['kysely', 'pino-pretty'],
    },
    frontend: {
      entry: ['src/main.tsx', 'vite.config.ts'],
      project: [
        'src/**/*.{ts,tsx}',
        'vite.config.ts',
        '../common/**/*.ts',
        '../core/src/**/*.ts',
      ],
      paths: {
        '@common/*': ['../common/*'],
        '@core/*': ['../core/src/*'],
      },
      ignore: ['dist/**', 'node_modules/**'],
      ignoreBinaries: ['vite', 'eslint'],
    },
    core: {
      // Entry points that are imported by BE/FE - knip will trace from these
      entry: [],
      project: ['src/**/*.ts'],
      ignore: ['node_modules/**'],
    },
  },
  // Global ignores
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/*.d.ts',
    'tools/**',
    'dev-notes/**',
    'docs/**',
    'issues/**',
    '_misc/**',
  ],
  // Don't report these as unused since they're commonly used in config files
  ignoreDependencies: [
    'prettier',
    'husky',
    'lint-staged',
    '@types/node',
    'typescript',
    'ts-node',
    'ts-jest',
    'jest',
    '@types/jest',
  ],
};

export default config;
