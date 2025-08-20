import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    '.': {
      ignoreBinaries: ['husky'],
      ignoreExportsUsedInFile: true,
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
      ],
      ignore: ['dist/**', 'node_modules/**'],
      ignoreBinaries: ['kysely', 'pino-pretty'],
      ignoreExportsUsedInFile: true,
    },
    frontend: {
      entry: ['src/main.tsx', 'vite.config.ts'],
      project: ['src/**/*.{ts,tsx}', 'vite.config.ts'],
      ignore: ['dist/**', 'node_modules/**'],
      ignoreBinaries: ['vite', 'eslint'],
      ignoreExportsUsedInFile: true,
    },
    core: {
      // Entry points that are imported by BE/FE - knip will trace from these
      entry: [],
      project: ['src/**/*.ts'],
      ignore: ['node_modules/**'],
      ignoreExportsUsedInFile: true,
      // Allow knip to report unused exports since we want to find them
    },
    common: {
      // Entry points that are imported by BE/FE - knip will trace from these
      entry: [],
      project: ['**/*.ts'],
      ignore: ['node_modules/**'],
      ignoreExportsUsedInFile: true,
      // Allow knip to report unused exports since we want to find them
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
