import { test, expect } from '@playwright/test';
import { setupMockAPI } from './helpers/mock-api';
import { loginAsTestUser } from './helpers/auth';

test.describe('Navigation & Layout UI', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
  });

  test('should render navbar links and controls for guest user', async ({ page }) => {
    await page.goto('/');

    const nav = page.locator('.nav');
    await expect(nav).toBeVisible();

    // Verify guest-only links
    await expect(page.locator('a:has-text("Sign In")')).toBeVisible();
    await expect(page.locator('a:has-text("Get Started")')).toBeVisible();

    // Verify main section links
    await expect(page.locator('a:has-text("How It Works")')).toBeVisible();
    await expect(page.locator('a:has-text("Features")')).toBeVisible();
  });

  test('should toggle dark/light theme', async ({ page }) => {
    await page.goto('/');

    const themeToggleBtn = page.locator('.theme-toggle-btn');
    await expect(themeToggleBtn).toBeVisible();

    // Get current theme on documentElement
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');

    // Click toggle button
    await themeToggleBtn.click();

    // Verify theme changed
    const toggledTheme = await html.getAttribute('data-theme');
    expect(toggledTheme).not.toBe(initialTheme);

    // Toggle back
    await themeToggleBtn.click();
    const finalTheme = await html.getAttribute('data-theme');
    expect(finalTheme).toBe(initialTheme);
  });

  test('should toggle Arabic/English language and text direction', async ({ page }) => {
    await page.goto('/');

    const langToggleBtn = page.locator('.lang-toggle-btn');
    await expect(langToggleBtn).toBeVisible();

    const html = page.locator('html');

    // Default should be English, ltr
    await expect(html).toHaveAttribute('lang', 'en');
    await expect(html).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('a:has-text("How It Works")')).toBeVisible();

    // Switch to Arabic
    await langToggleBtn.click();
    await expect(html).toHaveAttribute('lang', 'ar');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('a:has-text("كيف نعمل")')).toBeVisible();

    // Switch back to English
    await langToggleBtn.click();
    await expect(html).toHaveAttribute('lang', 'en');
    await expect(html).toHaveAttribute('dir', 'ltr');
  });

  test('should show profile dropdown for authenticated user', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/');

    // Guest sign in / get started buttons should be hidden
    await expect(page.locator('a:has-text("Sign In")')).not.toBeVisible();
    await expect(page.locator('a:has-text("Get Started")')).not.toBeVisible();

    // Avatar button should be visible
    const avatarBtn = page.locator('.profile-avatar-btn');
    await expect(avatarBtn).toBeVisible();

    // Click avatar to open dropdown
    await avatarBtn.click();

    // Verify dropdown header shows test user details
    const dropdown = page.locator('.profile-dropdown');
    await expect(dropdown).toHaveClass(/open/);
    await expect(page.locator('.profile-name')).toHaveText('Test Passenger');
    await expect(page.locator('.profile-email')).toHaveText('passenger@dride.com');

    // Verify dropdown items
    await expect(page.locator('.profile-dropdown-menu a:has-text("My Trips")')).toBeVisible();

    // Sign out should work and redirect to login
    await page.locator('.logout-btn').click();
    await expect(page).toHaveURL('/login');
  });

  test('should redirect unauthenticated users away from protected routes', async ({ page }) => {
    // Try accessing protected contact page
    await page.goto('/contact');
    await expect(page).toHaveURL(/\/login/);

    // Try accessing protected my-trips page
    await page.goto('/my-trips');
    await expect(page).toHaveURL(/\/login/);

    // Try accessing protected checkout page
    await page.goto('/checkout?tripId=trip-1');
    await expect(page).toHaveURL(/\/login/);
  });
});
