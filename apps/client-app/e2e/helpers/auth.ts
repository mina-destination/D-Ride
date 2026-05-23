import { Page } from '@playwright/test';
import { MOCK_USER } from './mock-api';

export async function loginViaUI(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'passenger@dride.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

export async function loginAsTestUser(page: Page) {
  // Pre-seed localStorage to bypass login form in other protected route tests
  await page.addInitScript((user) => {
    window.localStorage.setItem('dride_token', 'mock-jwt-token-123');
    window.localStorage.setItem('dride_user', JSON.stringify(user));
  }, MOCK_USER);
}
