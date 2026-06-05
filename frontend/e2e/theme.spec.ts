import { test, expect } from '@playwright/test'

// Settings → Appearance round-trip. Order-independent by design: rather than
// asserting a seed "default" (users.theme is mutable, so a partial re-run could
// leave it either way), it drives the theme to each value and proves the choice
// applies live (the `dark` class on <html>) and survives a reload (the boot
// script in index.html re-applies it before paint). Ends on dark so the suite's
// shared Alice row is left in the global-setup-pinned state. See #33.
test('settings theme round-trip: light and dark both apply and persist', async ({
  page,
}) => {
  await page.goto('/settings')

  const select = page.getByTestId('settings-theme-select')
  await expect(select).toBeVisible()

  // --- Light: applies live, persists past reload ---
  await select.selectOption('light')
  await expect(page.locator('html')).not.toHaveClass(/dark/)

  await page.reload()
  await expect(page.getByTestId('settings-theme-select')).toHaveValue('light')
  await expect(page.locator('html')).not.toHaveClass(/dark/)

  // --- Dark: applies live, persists past reload (self-cleaning) ---
  await page.getByTestId('settings-theme-select').selectOption('dark')
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.reload()
  await expect(page.getByTestId('settings-theme-select')).toHaveValue('dark')
  await expect(page.locator('html')).toHaveClass(/dark/)
})
