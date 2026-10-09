import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['node_modules/', 'dist/', 'coverage/', '.idea/', '.jbeval/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['scripts/**/*.ts', 'tests/**/*.ts', 'vitest.config.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true } },
  },
);
