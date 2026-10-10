import { defineConfig } from '@playwright/test';
import base from './playwright.config.ts';

/** Measurement runs (`npm run measure:perf`); not part of the CI gate. */
export default defineConfig({
  ...base,
  testMatch: '**/*.perf.ts',
  projects:
    base.projects?.filter((project) => project.name === 'desktop') ?? [],
  timeout: 300_000,
});
