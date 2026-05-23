# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication Flow >> should load login page and handle successful login
- Location: e2e/auth.spec.ts:9:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:5173/login", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img "D-Ride" [ref=e6]
    - heading "Welcome Back" [level=1] [ref=e7]
    - paragraph [ref=e8]: Sign in to book your ride
  - generic [ref=e9]:
    - generic [ref=e10]:
      - generic [ref=e11]: Email
      - textbox "Email" [ref=e12]:
        - /placeholder: you@example.com
    - generic [ref=e13]:
      - generic [ref=e14]: Password
      - textbox "Password" [ref=e15]:
        - /placeholder: ••••••••
    - button "Sign In" [ref=e16] [cursor=pointer]:
      - img [ref=e17]
      - text: Sign In
  - generic [ref=e20]:
    - text: Don't have an account?
    - link "Register" [ref=e21] [cursor=pointer]:
      - /url: /register
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { setupMockAPI } from './helpers/mock-api';
  3  | 
  4  | test.describe('Authentication Flow', () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await setupMockAPI(page);
  7  |   });
  8  | 
  9  |   test('should load login page and handle successful login', async ({ page }) => {
> 10 |     await page.goto('/login');
     |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  11 | 
  12 |     // Page title and subtitles
  13 |     await expect(page.locator('.auth-title')).toHaveText('Welcome Back');
  14 |     await expect(page.locator('.auth-subtitle')).toHaveText('Sign in to book your ride');
  15 | 
  16 |     // Navbar should be hidden on login page
  17 |     await expect(page.locator('.nav')).not.toBeVisible();
  18 | 
  19 |     // Fill form and submit
  20 |     await page.fill('#email', 'passenger@dride.com');
  21 |     await page.fill('#password', 'password123');
  22 |     await page.click('#login-submit-btn');
  23 | 
  24 |     // Redirect to home page and verify login state
  25 |     await expect(page).toHaveURL('/');
  26 |     await expect(page.locator('.profile-avatar-btn')).toBeVisible();
  27 |   });
  28 | 
  29 |   test('should show error for invalid login credentials', async ({ page }) => {
  30 |     await page.goto('/login');
  31 | 
  32 |     await page.fill('#email', 'wrong@dride.com');
  33 |     await page.fill('#password', 'wrongpassword');
  34 |     await page.click('#login-submit-btn');
  35 | 
  36 |     // Verify error notification
  37 |     const errorAlert = page.locator('.auth-error');
  38 |     await expect(errorAlert).toBeVisible();
  39 |     await expect(errorAlert).toHaveText('Invalid credentials');
  40 |   });
  41 | 
  42 |   test('should load register page and handle successful registration', async ({ page }) => {
  43 |     await page.goto('/register');
  44 | 
  45 |     await expect(page.locator('.auth-title')).toHaveText('Create Account');
  46 |     await expect(page.locator('.auth-subtitle')).toHaveText('Join the smarter commute');
  47 | 
  48 |     // Navbar should be hidden on register page
  49 |     await expect(page.locator('.nav')).not.toBeVisible();
  50 | 
  51 |     // Fill registration form
  52 |     await page.fill('#name', 'New Passenger');
  53 |     await page.fill('#email', 'new_passenger@dride.com');
  54 |     await page.fill('#phone', '01011112222');
  55 |     await page.fill('#password', 'securepassword');
  56 |     await page.click('button[type="submit"]');
  57 | 
  58 |     // Redirect to home page
  59 |     await expect(page).toHaveURL('/');
  60 |     await expect(page.locator('.profile-avatar-btn')).toBeVisible();
  61 |   });
  62 | 
  63 |   test('should show error when registering with existing email', async ({ page }) => {
  64 |     await page.goto('/register');
  65 | 
  66 |     await page.fill('#name', 'Exist User');
  67 |     await page.fill('#email', 'exists@dride.com');
  68 |     await page.fill('#phone', '01011112222');
  69 |     await page.fill('#password', 'securepassword');
  70 |     await page.click('button[type="submit"]');
  71 | 
  72 |     const errorAlert = page.locator('.auth-error');
  73 |     await expect(errorAlert).toBeVisible();
  74 |     await expect(errorAlert).toHaveText('Email already exists');
  75 |   });
  76 | 
  77 |   test('should navigate between login and register pages', async ({ page }) => {
  78 |     await page.goto('/login');
  79 | 
  80 |     // Go to register page
  81 |     await page.click('a:has-text("Register")');
  82 |     await expect(page).toHaveURL('/register');
  83 | 
  84 |     // Go to login page
  85 |     await page.click('a:has-text("Sign In")');
  86 |     await expect(page).toHaveURL('/login');
  87 |   });
  88 | });
  89 | 
```