import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('./artifacts/browser-acceptance.json', import.meta.url)) }]],
  use: {
    baseURL: 'http://127.0.0.1:5179',
    viewport: { width: 430, height: 932 },
    screenshot: 'only-on-failure',
    trace: 'off', // Canvas snapshots during every tap distort the 5–10s deadline.
    channel: 'chrome',
    browserName: 'chromium',
    isMobile: true,
    hasTouch: true,
    launchOptions: { args: ['--enable-webgl'] },
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    port: 5179,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
