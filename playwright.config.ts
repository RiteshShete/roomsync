import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the LOCAL Supabase stack (`npx supabase start`) with the real auth,
 * RLS and RPCs. Each test creates its own users, so no database reset is needed between runs.
 * Never point these at a hosted project: they create accounts and data.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 402, height: 874 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 402, height: 874 } } }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
