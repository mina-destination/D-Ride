import { test, expect } from '@playwright/test';
import { setupMockAPI } from './helpers/mock-api';
import { loginAsTestUser } from './helpers/auth';

test.describe('My Trips & Tickets Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
    await loginAsTestUser(page);
  });

  test('should load bookings page and display booking list', async ({ page }) => {
    await page.goto('/my-trips');

    // Page headers
    await expect(page.locator('h2')).toHaveText('My Bookings & Boarding Passes');

    // Ticket details
    const ticket = page.locator('.ticket-container');
    await expect(ticket).toHaveCount(1);
    await expect(ticket).toContainText('Maadi to Smart Village');
    await expect(ticket).toContainText('#1, 2'); // Seat Numbers
    await expect(ticket).toContainText('130 EGP'); // Fare Amount
    await expect(ticket).toContainText('Maadi Square'); // Pickup checkpoint
  });

  test('should support 3D card flip for telemetry info details', async ({ page }) => {
    await page.goto('/my-trips');

    const innerTicket = page.locator('.ticket-inner');
    await expect(innerTicket).not.toHaveClass(/flipped/);

    // Click Options button on front face
    await page.locator('button:has-text("Options")').click();
    await expect(innerTicket).toHaveClass(/flipped/);

    // Back face details
    await expect(page.locator('text=Ride Telemetry & Dossier')).toBeVisible();
    await expect(page.locator('text=Captain Ahmed')).toBeVisible();
    await expect(page.locator('text=Toyota HiAce (DR-20)')).toBeVisible();

    // Click Back button on back face
    await page.locator('button:has-text("Back")').click();
    await expect(innerTicket).not.toHaveClass(/flipped/);
  });

  test('should open QR verification modal when clicking QR code', async ({ page }) => {
    await page.goto('/my-trips');

    const qrBtn = page.locator('.pass-qr-mock');
    await expect(qrBtn).toBeVisible();

    // Verify modal is hidden initially
    await expect(page.locator('.qr-modal-content')).not.toBeVisible();

    // Click QR Code mockup
    await qrBtn.click();

    // Verify modal elements
    const qrModal = page.locator('.qr-modal-content');
    await expect(qrModal).toBeVisible();
    await expect(qrModal.locator('h3')).toHaveText('Boarding Pass QR 🎫');
    await expect(qrModal.locator('img')).toBeVisible(); // generated QR code image

    // Close modal
    await page.locator('.qr-modal-close-btn').click();
    await expect(page.locator('.qr-modal-content')).not.toBeVisible();
  });

  test('should trigger confirmation and cancel booking successfully', async ({ page }) => {
    await page.goto('/my-trips');

    // Flip to back to access cancel button
    await page.locator('button:has-text("Options")').click();

    const cancelBtn = page.locator('button:has-text("Cancel Seat")');
    await expect(cancelBtn).toBeVisible();

    // Handle confirm dialog
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Are you sure you want to cancel this trip booking?');
      await dialog.accept();
    });

    // Mock API cancel handler triggers reload
    await cancelBtn.click({ force: true });
  });

  test('should display empty state when passenger has no bookings', async ({ page }) => {
    // Override my-bookings endpoint to return empty array
    await page.route('**/api/bookings/my-bookings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/my-trips');

    await expect(page.locator('text=No Tickets Found')).toBeVisible();
    await expect(page.locator('text=Once you book your first ride')).toBeVisible();
  });
});
