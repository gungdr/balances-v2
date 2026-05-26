import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Standalone test config kept separate from vite.config.ts so the production
// build/dev config stays untouched (no react/tailwind plugins loaded for unit
// tests). First slice covers the pure `lib/*` helpers (ADR-0021), which need
// no DOM — `environment: 'node'`. When component tests land, add jsdom + RTL +
// MSW and a setup file here; the E2E suite (Playwright) stays out of this
// runner and out of the coverage metric.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Scope to the hand-written helpers for now; widen as more is tested.
      include: ['src/lib/**'],
    },
  },
})
