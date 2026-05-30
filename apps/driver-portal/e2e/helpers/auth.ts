import { Page } from '@playwright/test';
import { MOCK_DRIVER_USER } from './mock-api';

export async function loginAsDriver(page: Page) {
  await page.addInitScript((user) => {
    window.localStorage.setItem('dride_driver_token', 'mock-driver-jwt-token');
    window.localStorage.setItem('dride_user', JSON.stringify(user));
  }, MOCK_DRIVER_USER);
}

export async function loginViaUI(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'driver@dride.com');
  await page.fill('input[type="password"]', 'driver123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/trips');
}
