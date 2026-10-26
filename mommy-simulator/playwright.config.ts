import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5177', viewport: { width: 430, height: 932 },
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'iPhone', use: { browserName: 'chromium', channel: 'chrome', isMobile: true, hasTouch: true,
    launchOptions: { args: ['--enable-webgl'] } } }],
  webServer: { command: 'npm run dev', port: 5177, reuseExistingServer: true, timeout: 30000 },
});
