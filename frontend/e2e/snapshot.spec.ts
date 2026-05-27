import { test, expect } from '@playwright/test'

// Amount-only snapshot CRUD through the real UI + backend (ADR-0022): on a bank
// account detail page, record a monthly snapshot, edit it, then delete it. The
// month defaults to the current month (no future-date guard yet — that's a
// deferred item) so the create needs only an amount. Assertions key off a
// unique description; the amount renders IDR-formatted and is a poor anchor.
// Self-cleaning: deletes the snapshot and then the parent account, leaving the
// seed's empty bank-account list. See ADR-0024.
test('bank account snapshot create → edit → delete', async ({ page }) => {
  const account = `E2E snap account ${Date.now()}`
  const desc = `E2E snapshot ${Date.now()}`
  const editedDesc = `${desc} edited`

  await page.goto('/')
  await page.getByRole('tab', { name: 'Assets' }).click()
  await page.getByRole('tab', { name: 'Bank Accounts' }).click()

  // --- Create the parent bank account ---
  await page.getByRole('button', { name: '+ New bank account' }).first().click()
  const acctDialog = page.getByRole('dialog')
  await acctDialog.getByLabel('Display name').fill(account)
  await acctDialog.getByLabel('Bank name').fill('E2E Bank')
  await acctDialog.getByLabel('Account number').fill('1234567890')
  await acctDialog.getByRole('button', { name: 'Create' }).click()

  await page.getByRole('row', { name: new RegExp(account) }).getByText(account).click()
  await expect(page.getByRole('heading', { level: 1, name: account })).toBeVisible()

  // --- Create a snapshot (month defaults to the current month) ---
  await page.getByRole('button', { name: '+ New snapshot' }).click()
  const createDialog = page.getByRole('dialog')
  await expect(createDialog.getByText('Record monthly snapshot')).toBeVisible()
  await createDialog.getByLabel('Amount (IDR)').fill('12500000')
  await createDialog.getByLabel('Description (optional)').fill(desc)
  await createDialog.getByRole('button', { name: 'Save snapshot' }).click()

  const row = page.getByRole('row', { name: new RegExp(desc) })
  await expect(row).toBeVisible()

  // --- Edit the snapshot (change the description) ---
  await row.getByRole('button', { name: 'Snapshot actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  const editDialog = page.getByRole('dialog')
  await expect(editDialog.getByText('Edit snapshot')).toBeVisible()
  await editDialog.getByLabel('Description (optional)').fill(editedDesc)
  await editDialog.getByRole('button', { name: 'Save changes' }).click()

  const editedRow = page.getByRole('row', { name: new RegExp(editedDesc) })
  await expect(editedRow).toBeVisible()

  // --- Delete the snapshot (table returns to its empty state) ---
  await editedRow.getByRole('button', { name: 'Snapshot actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  const snapConfirm = page.getByRole('alertdialog')
  await snapConfirm.getByRole('button', { name: 'Delete' }).click()

  await expect(page.getByText(editedDesc)).toHaveCount(0)
  await expect(page.getByText('No snapshots yet.')).toBeVisible()

  // --- Delete the parent account (cleanup — returns to the empty list) ---
  await page.getByRole('button', { name: 'Delete' }).click()
  const acctConfirm = page.getByRole('alertdialog')
  await acctConfirm.getByRole('button', { name: 'Delete' }).click()

  await expect(page.getByText(account)).toHaveCount(0)
})
