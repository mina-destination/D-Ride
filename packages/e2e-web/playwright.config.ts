import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:5174', // Admin dashboard port
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /* Configure double webServer setups for Turborepo */
  webServer: [
    {
      command: 'npm run dev --workspace=apps/api',
      url: 'http://localhost:3000/health', // Health endpoint configured in main.ts
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'npm run dev --workspace=apps/admin-dashboard',
      url: 'http://localhost:5174', // Admin dashboard local dev port
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    }
  ],
});
