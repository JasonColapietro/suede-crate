import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1, retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3479', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
  webServer: [
    { command: 'node tests/fixture-server.mjs', url: 'http://127.0.0.1:3479', reuseExistingServer: !process.env.CI },
    { command: 'node server.mjs', url: 'http://127.0.0.1:3478', reuseExistingServer: !process.env.CI, env: { QLOO_API_KEY: '', PORT: '3478' } },
  ],
});
