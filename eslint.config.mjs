import path from 'node:path';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import pureImports from './tools/eslint/pure-imports.mjs';

const pureRoots = ['src/domain', 'src/config'].map((root) =>
  path.join(import.meta.dirname, root),
);

const injectedByPlatform =
  'Pure code must not read platform state; pass time, randomness and storage in explicitly.';

export default defineConfig(
  globalIgnores(['node_modules/', 'dist/', 'coverage/', '.idea/', '.jbeval/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: [
      'scripts/**/*.ts',
      'tests/**/*.ts',
      'src/**/*.ts',
      'vitest.config.ts',
      'vite.config.ts',
    ],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Domain and configuration: no Phaser, DOM, storage, audio, clock or RNG.
    files: ['src/domain/**/*.ts', 'src/config/**/*.ts'],
    plugins: {
      vlacek: {
        meta: { name: 'vlacek' },
        rules: { 'pure-imports': pureImports },
      },
    },
    rules: {
      'vlacek/pure-imports': ['error', { roots: pureRoots }],
      'no-restricted-globals': [
        'error',
        {
          globals: [
            'window',
            'self',
            'document',
            'navigator',
            'location',
            'localStorage',
            'sessionStorage',
            'indexedDB',
            'performance',
            'crypto',
            'fetch',
            'setTimeout',
            'setInterval',
            'requestAnimationFrame',
            'AudioContext',
            'globalThis',
          ].map((name) => ({ name, message: injectedByPlatform })),
          checkGlobalObject: true,
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: injectedByPlatform },
        { object: 'Date', property: 'now', message: injectedByPlatform },
        { object: 'performance', property: 'now', message: injectedByPlatform },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'NewExpression[callee.name="Date"]',
          message: injectedByPlatform,
        },
        {
          selector: 'CallExpression[callee.name="Date"]',
          message: injectedByPlatform,
        },
        {
          selector: 'MetaProperty[meta.name="import"]',
          message: 'Pure code must not depend on bundler or module metadata.',
        },
        {
          selector: 'TSModuleDeclaration[kind="global"]',
          message: 'Pure code must not augment global types.',
        },
      ],
      '@typescript-eslint/triple-slash-reference': [
        'error',
        { lib: 'never', path: 'never', types: 'never' },
      ],
    },
  },
);
