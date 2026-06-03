import { test, expect } from '@playwright/test';

// when we click sign in, it fires a call to Firebase Auth, so this tests
// Next.js routing, our auth guard, and the live external API. Therefore, it is
// end to end.
test('user sees an error when signing in with invalid credentials', async ({ page }) => {
  // Hitting `/` unauthenticated should bounce to /login via the auth guard.
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

  await page.getByPlaceholder('Email').fill('random-user@random67.com');
  await page.getByPlaceholder('Password').fill('a-wrong-password');
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // The error message from firebase will vary by the version so we match any
  // possible ones here. Also it uses a web-first assertion that auto-waits for
  // the round trip.
  const alert = page.getByText(
    /firebase|invalid-credential|wrong-password|user-not-found|email/i,
  );
  await expect(alert).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
