import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['junit', { outputFile: 'test-results/results.xml' }]]
    : 'html',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Firefox and WebKit projects are disabled by default since they require browser binaries
    // to be installed on the host machine. Run "npx playwright install" to enable them.
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev --prefix ../admin-dashboard',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev --prefix ../driver-portal',
      url: 'http://localhost:5175',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    }
  ],
});
