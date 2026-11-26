import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { sbhsClientName } from '../../src/lib/sbhs-rates';

test('month preview and download match the generated practice bill', async ({ page }) => {
  await page.goto('/demo?role=admin&view=billing');
  await page.getByRole('heading', { name: 'Invoice review' }).waitFor();
  await page.evaluate((site) => {
    const row = { site, stage: 'DELIVERED', counts: [2], inward: [2] };
    localStorage.setItem(
      'shree-training-handoff-v4',
      JSON.stringify([
        { ...row, id: 'visit-1', collectedAt: Date.parse('2026-11-03T08:00:00Z') },
        { ...row, id: 'visit-2', collectedAt: Date.parse('2026-11-03T10:00:00Z') },
      ]),
    );
    window.dispatchEvent(new Event('shree-training-handoff'));
  }, sbhsClientName);
  await page.getByLabel('Billing month').fill('2026-11');
  await page
    .getByRole('combobox', { name: 'Client', exact: true })
    .selectOption({ label: sbhsClientName });
  const register = page.getByRole('region', { name: 'Pickup quantities by date' });
  await expect(register.getByRole('columnheader', { name: /03.*2 pickups/ })).toBeVisible();
  await expect(register.getByText('4 pcs').first()).toBeVisible();
  await expect(register.getByText('₹48.00').first()).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download pickup register (CSV)' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('pickup-register-2026-11.csv');
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain('"2026-11-03"');
  expect(csv).toContain('"Pickup days","1","Pickups","2"');
  await page.getByRole('button', { name: 'Generate monthly bill' }).click();
  await expect(page.getByText('1 pickup days · 2 pickups · ₹48.00')).toBeVisible();
  await page.getByRole('button', { name: /Notifications, 1 pending/ }).click();
  const panel = page.getByRole('dialog', { name: 'Notifications' });
  await expect(panel).toBeVisible();
  await panel.getByRole('link', { name: /Bills awaiting payment verification/ }).click();
  await expect(page).toHaveURL(/view=payments#payment-receipts$/);
  await expect(panel).toBeHidden();
});

test('notification panel shows only the current practice role’s queues', async ({ page }) => {
  await page.goto('/demo?role=supervisor');
  await page.evaluate(() => {
    localStorage.setItem(
      'shree-training-handoff-v4',
      JSON.stringify([
        { id: 'assigned', site: 'Pickup location', stage: 'ASSIGNED' },
        { id: 'collected', site: 'Drop-off location', stage: 'COLLECTED' },
      ]),
    );
    window.dispatchEvent(new Event('shree-training-handoff'));
  });
  await page.getByRole('button', { name: /Notifications, 1 pending/ }).click();
  const panel = page.getByRole('dialog', { name: 'Notifications' });
  await expect(panel.getByRole('link', { name: /Pickups to verify/ })).toBeVisible();
  await expect(panel.getByRole('link', { name: /Assigned pickups/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await page.goto('/demo?role=executive');
  await page.getByRole('button', { name: /Notifications, 1 pending/ }).click();
  await expect(panel.getByRole('link', { name: /Assigned pickups/ })).toBeVisible();
  await expect(panel.getByRole('link', { name: /Pickups to verify/ })).toHaveCount(0);
});
