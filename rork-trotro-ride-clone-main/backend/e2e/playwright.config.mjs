import { defineConfig } from '@playwright/test';

const baseURL = String(process.env.E2E_STAGING_BASE_URL || '').replace(/\/$/, '');

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.mjs',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: process.env.E2E_REPORT || 'e2e-report.json' }]],
  use: {
    baseURL: `${baseURL}/api`,
    extraHTTPHeaders: { accept: 'application/json' },
  },
});
