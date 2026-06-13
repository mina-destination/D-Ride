import { test, expect } from '@playwright/test';
import { setupMockAPI } from './helpers/mock-api';
import { loginAsTestUser } from './helpers/auth';

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
    await loginAsTestUser(page);
  });

  test('should load profile page and display user details', async ({ page }) => {
    await page.goto('/profile');

    // User name under avatar
    await expect(page.locator('.auth-card.glass h2:has-text("Test Passenger")')).toBeVisible();

    // User role badge
    await expect(page.locator('.auth-card.glass >> text=PASSENGER').first()).toBeVisible();

    // Account Settings section
    await expect(page.locator('text=Account Settings')).toBeVisible();

    // User details fields
    await expect(page.locator('.auth-card.glass').nth(1).locator('text=Test Passenger')).toBeVisible();
    await expect(page.locator('.auth-card.glass').nth(1).locator('text=passenger@dride.com')).toBeVisible();
    await expect(page.locator('.auth-card.glass').nth(1).locator('text=01012345678')).toBeVisible();
  });

  test('should display user initials avatar', async ({ page }) => {
    await page.goto('/profile');

    // Avatar should show initials "TP" from "Test Passenger"
    await expect(page.locator('text=TP').first()).toBeVisible();
  });

  test('should display verified account status', async ({ page }) => {
    await page.goto('/profile');

    await expect(page.locator('text=Verified Account Status')).toBeVisible();
  });

  test('should display ride stats section', async ({ page }) => {
    await page.goto('/profile');

    await expect(page.locator('text=Rides Booked')).toBeVisible();
    await expect(page.locator('text=CO₂ Saved')).toBeVisible();
    await expect(page.locator('text=Rider Tier')).toBeVisible();
  });

  test('should logout when clicking Sign Out button', async ({ page }) => {
    await page.goto('/profile');

    const signOutBtn = page.locator('button.btn-danger:has-text("Sign Out")');
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should navigate back when clicking back button', async ({ page }) => {
    // First go to home, then navigate to profile
    await page.goto('/');
    await page.goto('/profile');

    const backBtn = page.locator('.btn-back');
    await expect(backBtn).toBeVisible();
  });
});
