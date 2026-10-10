import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const repoRoot = resolve(import.meta.dirname, '../..');
/** Set to test a deployed site (e.g. the Pages URL) instead of `dist/`. */
const externalBaseUrl = process.env['E2E_BASE_URL'];

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: resolve(repoRoot, 'test-results'),
  forbidOnly: true,
  retries: 0,
  fullyParallel: true,
  reporter: process.env['CI']
    ? [
        ['list'],
        [
          'html',
          {
            open: 'never',
            outputFolder: resolve(repoRoot, 'playwright-report'),
          },
        ],
      ]
    : 'list',
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${port}/`,
    trace: 'retain-on-failure',
  },
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          // `npm run test:e2e` builds first; the server only serves `dist/`.
          command: `npm run preview -- --port ${port} --strictPort`,
          cwd: repoRoot,
          url: `http://localhost:${port}/`,
          reuseExistingServer: false,
          timeout: 60_000,
        },
      }),
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'tablet-touch',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        hasTouch: true,
      },
    },
  ],
});
