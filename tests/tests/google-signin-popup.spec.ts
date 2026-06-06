import { test, expect } from '@playwright/test';

// when we click "Continue with Google" it opens a popup that navigates to
// Firebase's auth handler. Then it will redirect to Google's oauth screen.
// This should test that the Google sign-in button connects to the external Firebase
// oauth flow end to end.
test('clicking continue with google opens the firebase oauth popup', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

  // start listening for the popup before we click. otherwise the event
  // fires before we attach the listener and the promise hangs.
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: /continue with google/i }).click();
  const popup = await popupPromise;

  // Check whehter we got firebaseapp.com or accounts.google to see whether
  // we didn't hang and actually reached the oauth endpoint
  await popup.waitForURL(/firebaseapp\.com|accounts\.google/i, { timeout: 15000 });
  expect(popup.url()).toMatch(/firebaseapp\.com|accounts\.google/i);

  await popup.close();
});
