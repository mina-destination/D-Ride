import { test, expect } from '@playwright/test';
import { setupAdminMockAPI } from './helpers/mock-api';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin Administrators Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminMockAPI(page);
    await loginAsAdmin(page);
  });

  test('should load administrators page and display admin list', async ({ page }) => {
    await page.goto('/administrators');


    await expect(page.locator('.ant-table').locator('text=System Owner').first()).toBeVisible();
    await expect(page.locator('.ant-table').locator('text=Operations Manager').first()).toBeVisible();
  });

  test('should display admin roles', async ({ page }) => {
    await page.goto('/administrators');


    await expect(page.locator('.ant-table').locator('text=OWNER').first()).toBeVisible();
    await expect(page.locator('.ant-table').locator('text=OPERATION').first()).toBeVisible();
  });

  test('should have create admin button', async ({ page }) => {
    await page.goto('/administrators');


    const addBtn = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New"), button:has-text("Invite")').first();
    await expect(addBtn).toBeVisible();
  });
});
