import { defineConfig, devices } from '@playwright/test';

// webServer auto-launches the Next.js dev server and the FastAPI backend
// if either one isn't already up.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../frontend',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'venv/bin/uvicorn main:app --port 8000',
      cwd: '../backend',
      url: 'http://localhost:8000/grades/departments',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
