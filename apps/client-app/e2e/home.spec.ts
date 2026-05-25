import { test, expect } from '@playwright/test';
import { setupMockAPI, MOCK_ROUTES } from './helpers/mock-api';
import { loginAsTestUser } from './helpers/auth';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
  });

  test('should load all main sections and content for guest user', async ({ page }) => {
    await page.goto('/');

    // Hero title check
    const heroTitle = page.locator('.hero-title');
    await expect(heroTitle).toContainText('Your Daily');
    await expect(heroTitle).toContainText('Commute, Reinvented.');

    // Stats bar check
    await expect(page.locator('.stats-bar')).toBeVisible();
    await expect(page.locator('text=150+')).toBeVisible();
    await expect(page.locator('text=Daily Routes')).toBeVisible();

    // How It Works section
    await expect(page.locator('#how-it-works')).toBeVisible();
    await expect(page.locator('text=Simple & Fast')).toBeVisible();

    // Features section
    await expect(page.locator('#features')).toBeVisible();
    await expect(page.locator('text=Why D-Ride')).toBeVisible();

    // CTA check for guests
    const bookRideCTA = page.locator('a:has-text("Book a Ride")');
    await expect(bookRideCTA).toBeVisible();
    await expect(bookRideCTA).toHaveAttribute('href', '/register');

    // Footer brand check
    await expect(page.locator('.footer-tagline')).toContainText('Operated by Destination');
  });

  test('should display My Trips CTA when authenticated', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/');

    const myTripsCTA = page.locator('a.btn-primary:has-text("My Trips")');
    await expect(myTripsCTA).toBeVisible();
    await expect(myTripsCTA).toHaveAttribute('href', '/my-trips');
  });

  test('should handle route search workflow correctly', async ({ page }) => {
    await page.goto('/');

    // Search button starts disabled
    const searchBtn = page.locator('#search-trips-btn');
    await expect(searchBtn).toBeDisabled();

    // Select From City "Maadi"
    await page.locator('.from-to-field:has-text("From City") .custom-select-trigger').click();
    await page.locator('.custom-dropdown-menu .custom-dropdown-item:has-text("Maadi")').click();

    // Select To City "Smart Village"
    await page.locator('.from-to-field:has-text("To City") .custom-select-trigger').click();
    await page.locator('.custom-dropdown-menu .custom-dropdown-item:has-text("Smart Village")').click();

    // Search button is now enabled
    await expect(searchBtn).toBeEnabled();

    // Select From Station "Ring Road"
    await page.locator('.from-to-field:has-text("From Station") .custom-select-trigger').click();
    await page.locator('.custom-dropdown-menu .custom-dropdown-item:has-text("Ring Road")').click();

    // Click search
    await searchBtn.click();

    // Navigates to search page with pickupLat, pickupLng, dropoffLat, dropoffLng
    await expect(page).toHaveURL(
      new RegExp(`\\/search\\?pickupLat=30\\.01&pickupLng=31\\.15&dropoffLat=30\\.08&dropoffLng=30\\.78`)
    );
  });
});
