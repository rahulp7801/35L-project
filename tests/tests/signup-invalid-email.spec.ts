import { test, expect } from '@playwright/test';

// in this test we change to "create account" mode and we try to test whether
// email validation works. firebase should reject the email because it has no
// valid domain and thus no user is actually created.
test('user sees an error when signing up with an invalid email', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

  // the footer "Sign up" link is the only button with that name while we're
  // in sign-in mode, so this click toggles the form
  await page.getByRole('button', { name: /^sign up$/i }).click();
  await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();

  // `test@x` passes chrome's type=email check but firebase rejects it
  await page.getByPlaceholder('Email').fill('test@x');
  await page.getByPlaceholder('Password').fill('validpass123');

  // Now the only "sign up" button is the submit; so the toggle reads "sign in"
  await page.getByRole('button', { name: /^sign up$/i }).click();

  await expect(
    page.getByText(/firebase|invalid-email|email/i),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
