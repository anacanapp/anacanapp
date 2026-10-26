import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: './artifacts/browser-acceptance.json' }]],
  outputDir: './test-results',
  use: { baseURL: 'http://127.0.0.1:5188', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'iPhone WebKit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'Android Chrome', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5188', reuseExistingServer: !process.env.CI, timeout: 60000 },
});
