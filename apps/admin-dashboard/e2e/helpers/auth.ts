import { Page } from '@playwright/test';
import { MOCK_ADMIN_USER } from './mock-api';

export async function loginAsAdmin(page: Page) {
  await page.addInitScript((user) => {
    window.localStorage.setItem('dride_token', 'mock-admin-jwt-token');
    window.localStorage.setItem('dride_user', JSON.stringify(user));
  }, MOCK_ADMIN_USER);
}

export async function loginViaUI(page: Page) {
  await page.goto('/login');
  await page.fill('#email', 'owner@dride.com');
  await page.fill('#password', 'owner123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}
