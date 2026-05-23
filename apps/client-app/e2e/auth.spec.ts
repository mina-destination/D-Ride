import { test, expect } from '@playwright/test';
import { setupMockAPI } from './helpers/mock-api';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
  });

  test('should load login page and handle successful login', async ({ page }) => {
    await page.goto('/login');

    // Page title and subtitles
    await expect(page.locator('.auth-title')).toHaveText('Welcome Back');
    await expect(page.locator('.auth-subtitle')).toHaveText('Sign in to book your ride');

    // Navbar should be hidden on login page
    await expect(page.locator('.nav')).not.toBeVisible();

    // Fill form and submit
    await page.fill('#email', 'passenger@dride.com');
    await page.fill('#password', 'password123');
    await page.click('#login-submit-btn');

    // Redirect to home page and verify login state
    await expect(page).toHaveURL('/');
    await expect(page.locator('.profile-avatar-btn')).toBeVisible();
  });

  test('should show error for invalid login credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', 'wrong@dride.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('#login-submit-btn');

    // Verify error notification
    const errorAlert = page.locator('.auth-error');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toHaveText('Invalid credentials');
  });

  test('should load register page and handle successful registration', async ({ page }) => {
    await page.goto('/register');

    await expect(page.locator('.auth-title')).toHaveText('Create Account');
    await expect(page.locator('.auth-subtitle')).toHaveText('Join the smarter commute');

    // Navbar should be hidden on register page
    await expect(page.locator('.nav')).not.toBeVisible();

    // Fill registration form
    await page.fill('#name', 'New Passenger');
    await page.fill('#email', 'new_passenger@dride.com');
    await page.fill('#phone', '01011112222');
    await page.fill('#password', 'securepassword');
    await page.click('button[type="submit"]');

    // Redirect to home page
    await expect(page).toHaveURL('/');
    await expect(page.locator('.profile-avatar-btn')).toBeVisible();
  });

  test('should show error when registering with existing email', async ({ page }) => {
    await page.goto('/register');

    await page.fill('#name', 'Exist User');
    await page.fill('#email', 'exists@dride.com');
    await page.fill('#phone', '01011112222');
    await page.fill('#password', 'securepassword');
    await page.click('button[type="submit"]');

    const errorAlert = page.locator('.auth-error');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toHaveText('Email already exists');
  });

  test('should navigate between login and register pages', async ({ page }) => {
    await page.goto('/login');

    // Go to register page
    await page.click('a:has-text("Register")');
    await expect(page).toHaveURL('/register');

    // Go to login page
    await page.click('a:has-text("Sign In")');
    await expect(page).toHaveURL('/login');
  });
});
