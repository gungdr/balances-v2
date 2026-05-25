import { defineConfig, devices } from '@playwright/test'

// E2E against a dedicated balances_e2e backend (port 8099) + a dedicated vite
// instance (port 5273) so the developer's 8080/5173 dev servers are never
// touched. Auth is injected as a session cookie via storageState (global
// setup) rather than driving Google OAuth — see ADR-0024. The DB is seeded by
// `make e2e` before Playwright launches, so the backend's auto-migrate is a
// no-op and there is no migration race. Entry point is `make e2e`.
const E2E_BACKEND_PORT = 8099
const E2E_FRONTEND_PORT = 5273

export default defineConfig({
  testDir: './e2e',
  // Single household, single shared DB: tests must not run concurrently.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${E2E_FRONTEND_PORT}`,
    storageState: 'e2e/.auth/state.json',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'go run ./cmd/balances serve',
      cwd: '../backend',
      env: {
        PORT: String(E2E_BACKEND_PORT),
        // Set by `make e2e`; the seed step has already migrated this DB.
        DATABASE_URL: process.env.E2E_DATABASE_URL ?? '',
      },
      url: `http://localhost:${E2E_BACKEND_PORT}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --port ${E2E_FRONTEND_PORT} --strictPort`,
      env: { API_PROXY_TARGET: `http://localhost:${E2E_BACKEND_PORT}` },
      url: `http://localhost:${E2E_FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
