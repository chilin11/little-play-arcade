import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:5187', trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/serve.mjs', env: { PORT: '5187' }, url: 'http://127.0.0.1:5187', reuseExistingServer: false },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1080 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }
  ]
});
