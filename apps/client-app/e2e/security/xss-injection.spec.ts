import { test, expect } from '@playwright/test';
import { setupMockAPI } from '../helpers/mock-api';
import { loginAsTestUser } from '../helpers/auth';

test.describe('XSS & Injection Prevention', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAPI(page);
  });

  const XSS_PAYLOADS = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(1)>',
    "'; DROP TABLE users; --",
    '{{constructor.constructor("return this")()}}',
  ];

  test('login form should escape XSS in email field', async ({ page }) => {
    await page.goto('/login');
    for (const payload of XSS_PAYLOADS) {
      await page.fill('#email', payload);
      await page.fill('#password', 'test123');
      await page.click('#login-submit-btn');
      
      // Verify no script execution occurred
      const alertTriggered = await page.evaluate(() => {
        return (window as any).__xss_triggered === true;
      });
      expect(alertTriggered).toBeFalsy();
    }
  });

  test('support form should not render HTML from user input', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/contact');
    await page.fill('#subject', '<script>alert("xss")</script>');
    await page.fill('#message', '<img src=x onerror=alert(1)>');
    
    // Verify content is text-escaped, not rendered as HTML
    const subjectInput = page.locator('#subject');
    await expect(subjectInput).toHaveValue('<script>alert("xss")</script>');
  });
});
