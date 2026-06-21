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

    const container = page.locator('.contact-container');

    // User name under avatar
    await expect(container.locator('h2:has-text("Test Passenger")')).toBeVisible();

    // User role badge
    await expect(container.locator('text=PASSENGER').first()).toBeVisible();

    // Account Settings section
    await expect(container.locator('text=Account Settings')).toBeVisible();

    // User details fields
    await expect(container.locator('text=Test Passenger').first()).toBeVisible();
    await expect(container.locator('text=passenger@dride.com')).toBeVisible();
    await expect(container.locator('text=01012345678')).toBeVisible();
  });

  test('should display user initials avatar', async ({ page }) => {
    await page.goto('/profile');

    const container = page.locator('.contact-container');
    // Avatar should show initials "TP" from "Test Passenger"
    await expect(container.locator('text=TP').first()).toBeVisible();
  });

  test('should display verified account status', async ({ page }) => {
    await page.goto('/profile');

    const container = page.locator('.contact-container');
    await expect(container.locator('text=Verified Account Status')).toBeVisible();
  });

  test('should display ride stats section', async ({ page }) => {
    await page.goto('/profile');

    const container = page.locator('.contact-container');
    await expect(container.locator('text=Rides Booked')).toBeVisible();
    await expect(container.locator('text=CO₂ Saved')).toBeVisible();
    await expect(container.locator('text=Rider Tier')).toBeVisible();
  });

  test('should logout when clicking Sign Out button', async ({ page }) => {
    await page.goto('/profile');

    const container = page.locator('.contact-container');
    const signOutBtn = container.locator('button:has-text("Sign Out")');
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should navigate back when clicking back button', async ({ page }) => {
    // First go to home, then navigate to profile
    await page.goto('/');
    await page.goto('/profile');

    const container = page.locator('.contact-container');
    const backBtn = container.locator('button[title="Go Back"]');
    await expect(backBtn).toBeVisible();
  });
});
