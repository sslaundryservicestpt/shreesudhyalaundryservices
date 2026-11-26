import { expect, test } from '@playwright/test';
import { sbhsClientName, sbhsRates } from '../../src/lib/sbhs-rates';

test('shows the SBHS price card and shares the saved client name', async ({ page }) => {
  await page.goto('/demo?role=admin&view=clients');
  await expect(page.getByRole('option', { name: sbhsClientName, exact: true })).toBeAttached();
  const table = page.getByRole('region', { name: 'Item prices' });
  await expect(table.getByRole('row')).toHaveCount(15);
  for (const [item, standard, stain] of sbhsRates) {
    await expect(table.getByLabel(item + ' standard price', { exact: true })).toHaveValue(
      standard.toFixed(2),
    );
    await expect(table.getByLabel(item + ' heavy stain price', { exact: true })).toHaveValue(
      stain.toFixed(2),
    );
  }
  const first = table.getByLabel('Single Bed Sheet standard price', { exact: true });
  await expect(first).toHaveAttribute('max', '999.99');
  await first.fill('21');
  await page.getByRole('button', { name: 'Save client prices' }).click();
  await expect(page.getByText('Saved in this browser.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(first).toHaveValue('21.00');
  await page.goto('/demo?role=supervisor&view=assign');
  await expect(page.getByRole('option', { name: sbhsClientName, exact: true })).toBeAttached();
  await page.getByLabel('Client site').selectOption(sbhsClientName);
  await page.getByRole('button', { name: 'Assign pickup to Executive' }).click();
  await page.goto('/demo?role=executive&view=pickups');
  await expect(page.getByRole('option', { name: sbhsClientName, exact: true })).toBeAttached();
  await page.goto('/demo?role=admin&view=billing');
  await expect(page.getByRole('option', { name: sbhsClientName, exact: true })).toBeAttached();
});

test('demo stays on isolated sample dashboards', async ({ page }) => {
  const businessRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) businessRequests.push(request.url());
  });
  await page.goto('/login');
  await page.evaluate(() => {
    const site = 'SDHR - Tiruchanoor';
    localStorage.setItem(
      'shree-admin-practice-v1',
      JSON.stringify({
        clients: [
          {
            id: 'sbhs-client',
            name: site,
            branches: [{ id: 'sbhs-tiruchanoor', name: site, rates: { Runner: 1000 } }],
          },
        ],
        bills: [],
        expenses: [],
        losses: [],
      }),
    );
    localStorage.setItem(
      'shree-training-handoff-v3',
      JSON.stringify([{ id: 'initial-pickup', site, stage: 'ASSIGNED' }]),
    );
  });
  await page.getByRole('link', { name: 'Executive demo dashboard' }).click();
  await expect(page.getByText('Practice workspace · Entries stay in this browser.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Choose a demo role' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/demo\?role=executive/);
  const executiveMenu = page.getByRole('navigation', { name: 'Executive menu' });
  await expect(executiveMenu.getByRole('link')).toHaveCount(5);
  await expect(page.getByRole('link', { name: 'Delivery route' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Notifications' })).toHaveCount(0);
  await page.getByRole('link', { name: /Queued deliveries/ }).click();
  await expect(page).toHaveURL(/\/demo\?role=executive&view=deliveries/);
  await expect(page.getByRole('heading', { name: 'Deliveries to complete' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to dashboard' })).toHaveCount(0);
  await expect(page.getByText('No deliveries in the queue.')).toBeVisible();
  await executiveMenu.getByRole('link', { name: 'Completed deliveries' }).click();
  await expect(page.getByText('No completed deliveries yet.')).toBeVisible();
  await executiveMenu.getByRole('link', { name: 'Overview' }).click();
  await expect(page.getByRole('heading', { name: 'My pickups & deliveries' })).toBeVisible();
  await executiveMenu.getByRole('link', { name: 'Pickup queue' }).click();
  await expect(page.getByRole('heading', { name: 'Pickup queue' })).toBeVisible();
  await expect(page.getByText('You’re all caught up.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Back to sign-in' }).click();
  for (const [label, role] of [
    ['Admin', 'admin'],
    ['Supervisor', 'supervisor'],
  ]) {
    await page.getByRole('link', { name: label + ' demo dashboard' }).click();
    await expect(page).toHaveURL(new RegExp('/demo[?]role=' + role + '$'));
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Back to sign-in' }).click();
  }
  await page.getByRole('link', { name: 'Admin demo dashboard' }).click();
  const adminMenu = page.getByRole('navigation', { name: 'Admin menu' });
  const adminMetrics = page.getByLabel('Admin dashboard', { exact: true });
  await expect(adminMetrics.getByRole('link', { name: /Clients 1 Manage/ })).toBeVisible();
  await expect(adminMetrics.getByRole('link', { name: /Client rates/ })).toHaveCount(0);
  await adminMetrics.getByRole('link', { name: /Manage clients and prices/ }).click();
  for (const name of ['Training account', 'Second account', 'North account', 'South account']) {
    await page.getByLabel('Client name').fill(name);
    await page.getByRole('button', { name: 'Save client', exact: true }).click();
  }
  await expect(page.getByLabel('Branch name')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to sign-in' }).click();
  await page.getByRole('link', { name: 'Supervisor demo dashboard' }).click();
  const supervisorMenu = page.getByRole('navigation', { name: 'Supervisor menu' });
  await supervisorMenu.getByRole('link', { name: 'Processing stages' }).click();
  await expect(page.getByText('No verified pickups awaiting processing.')).toBeVisible();
  await supervisorMenu.getByRole('link', { name: 'Assign a pickup', exact: true }).click();
  await expect(page.getByRole('option', { name: /SDHR/i })).toHaveCount(0);
  await expect(page.getByRole('option', { name: sbhsClientName, exact: true })).toBeAttached();
  await page.getByLabel('Client site').selectOption('Training account');
  await page.getByLabel('Pickup instructions').fill('Collect from reception');
  await page.getByRole('button', { name: 'Assign pickup to Executive' }).click();
  await page.getByRole('link', { name: 'Back to sign-in' }).click();
  await page.getByRole('link', { name: 'Executive demo dashboard' }).click();
  await page.getByRole('link', { name: /Pending pickups/ }).click();
  await expect(page.getByRole('button', { name: /Training account/ })).toBeVisible();
  await expect(page.getByLabel('Double Duvet')).toBeVisible();
  await expect(page.getByLabel('Runner')).toBeVisible();
  await page.getByLabel('Single Bed Sheet', { exact: true }).fill('8');
  await page.getByLabel('Bath Towel', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Send to supervisor' }).click();
  await expect(page.getByRole('button', { name: /Training account/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Pickup history' }).click();
  await expect(page.getByRole('heading', { name: 'Pickup history' })).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByRole('button', { name: /Training account.*Awaiting inward count/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to sign-in' }).click();
  await page.getByRole('link', { name: 'Supervisor demo dashboard' }).click();
  await supervisorMenu.getByRole('link', { name: 'Verify received pickups' }).click();
  await expect(page.getByLabel('Client site')).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('button', { name: /Training account/ }).click();
  await expect(page.getByText('12 pieces collected', { exact: true })).toBeVisible();
  await expect(page.getByText('Single Bed Sheet · 8 collected', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(14);
  await page.getByRole('checkbox', { name: /Single Bed Sheet/ }).check();
  await expect(page.getByRole('checkbox', { name: /Single Bed Sheet/ })).toBeChecked();
  await page.getByText('Report a count mismatch', { exact: true }).click();
  await page.getByLabel('Received Single Bed Sheet').fill('7');
  await page.getByLabel('Received Bath Towel').fill('4');
  await page.getByRole('button', { name: 'Submit inward count' }).click();
  await expect(
    page.getByRole('button', { name: /Training account.*Count mismatch/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to sign-in' }).click();
  await page.getByRole('link', { name: 'Admin demo dashboard' }).click();
  await adminMetrics.getByRole('link', { name: /Manage clients and prices/ }).click();
  await page.getByLabel('Client name').fill('Maple Hospitality');
  await page.getByRole('button', { name: 'Save client', exact: true }).click();
  await page.getByLabel('Single Bed Sheet standard price').fill('12.50');
  await page.getByLabel('Single Bed Sheet heavy stain price').fill('15');
  await page.getByRole('button', { name: 'Save client prices' }).click();
  await page.reload();
  await page
    .getByRole('combobox', { name: 'Client', exact: true })
    .selectOption({ label: 'Maple Hospitality' });
  await expect(page.getByLabel('Single Bed Sheet standard price')).toHaveValue('12.50');
  await expect(page.getByLabel('Single Bed Sheet heavy stain price')).toHaveValue('15.00');
  await adminMenu.getByRole('link', { name: 'Overview' }).click();
  await expect(adminMetrics.getByRole('link', { name: /Clients 6 Manage/ })).toBeVisible();
  await adminMetrics.getByRole('link', { name: /Manage clients and prices/ }).click();
  await expect(page.getByRole('heading', { name: 'Item prices' })).toBeVisible({ timeout: 15000 });
  await adminMenu.getByRole('link', { name: 'Invoice review' }).click();
  await expect(page.getByText('Review the draft and rate snapshot')).toBeVisible();
  await adminMenu.getByRole('link', { name: 'Overview' }).click();
  await adminMetrics.getByRole('link', { name: /Handoffs to review 1/ }).click();
  await page.getByLabel('Review note').fill('Checked the difference with the laundry team.');
  await page.getByRole('button', { name: 'Record review' }).click();
  await page.reload();
  await expect(page.locator('.practice-handoff .section-heading .pill')).toHaveText(
    'Admin reviewed',
  );
  await page.getByRole('link', { name: 'Back to sign-in' }).click();
  await page.getByRole('link', { name: 'Supervisor demo dashboard' }).click();
  await supervisorMenu.getByRole('link', { name: 'Assign a pickup', exact: true }).click();
  await page.getByLabel('Client site').selectOption('Second account');
  await page.getByRole('button', { name: 'Assign pickup to Executive' }).click();
  await page.getByRole('link', { name: 'Back to sign-in' }).click();
  await page.getByRole('link', { name: 'Executive demo dashboard' }).click();
  await page.getByRole('link', { name: /Pending pickups/ }).click();
  await expect(
    page
      .getByRole('combobox', { name: 'Assigned client site' })
      .getByRole('option', { name: 'Second account' }),
  ).toBeAttached();
  await page.getByLabel('Runner', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Send to supervisor' }).click();
  await page.getByRole('link', { name: 'Back to sign-in' }).click();
  await page.getByRole('link', { name: 'Supervisor demo dashboard' }).click();
  await supervisorMenu.getByRole('link', { name: 'Verify received pickups' }).click();
  await page.getByRole('button', { name: /Second account/ }).click();
  await expect(page.getByRole('spinbutton').filter({ visible: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Verify and process' }).click();
  await expect(
    page.getByRole('button', { name: /Second account.*Awaiting inward count/ }),
  ).toBeVisible();
  for (const box of await page.getByRole('checkbox').all()) await box.check();
  await page.getByRole('button', { name: 'Verify and process' }).click();
  await expect(
    page.getByRole('button', { name: /Second account.*Ready for processing/ }),
  ).toBeVisible();
  await supervisorMenu.getByRole('link', { name: 'Processing stages' }).click();
  await page
    .getByRole('region', { name: 'Processing batches' })
    .getByText('Second account', { exact: true })
    .click();
  for (const step of ['Wash', 'Dry', 'Iron', 'Fold']) {
    await page.getByRole('checkbox', { name: step + ' completed' }).check();
  }
  await page.getByRole('button', { name: 'Complete processing' }).click();
  await expect(page.getByText(/Processing complete. The order is now/)).toBeVisible();
  await supervisorMenu.getByRole('link', { name: 'Quality checks' }).click();
  const quality = page.getByRole('region', { name: 'Quality checks' });
  await quality.getByText('Second account', { exact: true }).click();
  await expect(quality.getByRole('spinbutton')).toHaveCount(0);
  await expect(quality.getByRole('checkbox', { name: /Runner.*1 pcs/ })).toBeVisible();
  await quality.getByText('Report a count or fabric issue', { exact: true }).click();
  await quality.getByLabel('Runner recounted').fill('0');
  await quality
    .getByLabel('Loss or damage notes', { exact: true })
    .fill('Runner missing at first recount');
  await quality.getByRole('button', { name: 'Record quality hold' }).click();
  await expect(quality.getByRole('alert')).toContainText('Quality hold recorded');
  await supervisorMenu.getByRole('link', { name: 'Prepare dispatch' }).click();
  await expect(page.getByText('No quality-verified orders ready for dispatch.')).toBeVisible();
  await supervisorMenu.getByRole('link', { name: 'Quality checks' }).click();
  await quality.getByText('Second account', { exact: true }).click();
  await expect(quality.getByRole('list', { name: 'Quality notes' })).toContainText(
    'Runner missing at first recount',
  );
  await quality.getByRole('button', { name: 'Save quality check' }).click();
  await expect(quality.getByRole('checkbox', { name: /Runner.*1 pcs/ })).toBeVisible();
  await quality.getByRole('checkbox', { name: /Runner.*1 pcs/ }).check();
  await quality.getByRole('checkbox', { name: 'Fabric quality passed' }).check();
  await quality.getByRole('button', { name: 'Save quality check' }).click();
  await expect(quality.getByRole('status')).toContainText('Quality verified');
  await supervisorMenu.getByRole('link', { name: 'Prepare dispatch' }).click();
  await page
    .getByRole('region', { name: 'Ready for dispatch' })
    .getByText('Second account', { exact: true })
    .click();
  await page.getByRole('button', { name: 'Ready for dispatch', exact: true }).click();
  await expect(page.getByText(/now in the Executive’s delivery queue/)).toBeVisible();
  for (const branch of ['North account', 'South account']) {
    await supervisorMenu.getByRole('link', { name: 'Assign a pickup', exact: true }).click();
    await page.getByLabel('Client site').selectOption(branch);
    await page.getByRole('button', { name: 'Assign pickup to Executive' }).click();
  }
  await page.getByRole('link', { name: 'Back to sign-in' }).click();
  await page.getByRole('link', { name: 'Executive demo dashboard' }).click();
  await page.getByRole('link', { name: /1 Queued deliveries/ }).click();
  const delivery = page.getByRole('region', { name: 'Queued deliveries' });
  await delivery.getByText('Second account', { exact: true }).click();
  await delivery.getByLabel('Received by').fill('Reception');
  await delivery.getByRole('checkbox', { name: 'Recipient acknowledged all items' }).check();
  await delivery.getByRole('button', { name: 'Confirm delivery' }).click();
  await expect(delivery.getByRole('status')).toContainText('Delivery confirmed');
  await page.getByRole('link', { name: 'Completed deliveries', exact: true }).click();
  await page
    .getByRole('region', { name: 'Completed deliveries' })
    .getByText('Second account', { exact: true })
    .click();
  await expect(page.getByText('Reception', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Pickup queue' }).click();
  await expect(page.getByText('2 awaiting action', { exact: true })).toBeVisible();
  for (const [branch, count] of [
    ['South account', '2'],
    ['North account', '5'],
  ]) {
    await page.getByRole('button', { name: new RegExp(branch) }).click();
    await page.getByLabel('Runner', { exact: true }).fill(count);
    await page.getByRole('button', { name: 'Send to supervisor' }).click();
    await expect(page.getByRole('button', { name: new RegExp(branch) })).toHaveCount(0);
    if (branch === 'South account') {
      await expect(page.getByRole('button', { name: /North account/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(page.getByLabel('Runner', { exact: true })).toHaveValue('0');
    }
  }
  await page.getByRole('link', { name: 'Back to sign-in' }).click();
  await page.getByRole('link', { name: 'Supervisor demo dashboard' }).click();
  await supervisorMenu.getByRole('link', { name: 'Verify received pickups' }).click();
  await expect(page.getByText('2 awaiting action', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /South account/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: /South account/ }).click();
  await expect(page.getByText('2 pieces collected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /North account/ }).click();
  await expect(page.getByText('5 pieces collected', { exact: true })).toBeVisible();
  for (const box of await page.getByRole('checkbox').all()) await box.check();
  await page.getByRole('button', { name: 'Verify and process' }).click();
  await expect(page.getByText('1 awaiting action', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /South account.*Awaiting inward count/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to sign-in' }).click();
  await page.getByRole('link', { name: 'Admin demo dashboard' }).click();
  await adminMenu.getByRole('link', { name: 'Clients & pricing' }).click();
  await page
    .getByRole('combobox', { name: 'Client', exact: true })
    .selectOption({ label: 'Second account' });
  await page.getByLabel('Runner standard price').fill('7');
  await page.getByRole('button', { name: 'Save client prices' }).click();
  await page.getByLabel('Runner standard price').fill('8');
  await page.getByRole('button', { name: 'Save client prices' }).click();
  await adminMenu.getByRole('link', { name: 'Invoice review' }).click();
  await expect(page.getByRole('heading', { name: 'Invoice review' })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Client', exact: true })
    .selectOption({ label: 'Second account' });
  const month = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
  await page.getByLabel('Billing month').fill(month);
  await page.getByRole('button', { name: 'Generate monthly bill' }).click();
  await expect(page.getByText('1 pickup days · 1 pickups · ₹8.00')).toBeVisible();
  await adminMenu.getByRole('link', { name: 'Overview' }).click();
  await expect(
    adminMetrics.getByRole('link', { name: /Payment-confirmed sales ₹0.00/ }),
  ).toBeVisible();
  await adminMetrics.getByRole('link', { name: /Bills awaiting payment verification 1/ }).click();
  await expect(page).toHaveURL(/#payment-receipts$/);
  await expect(
    page.getByRole('heading', { name: 'Payment-confirmed sales · ₹0.00' }),
  ).toBeVisible();
  await page.getByLabel('Full-payment reference').fill('Practice bank receipt');
  await page.getByRole('button', { name: 'Verify funds credited' }).click();
  await expect(
    page.getByRole('heading', { name: 'Payment-confirmed sales · ₹8.00' }),
  ).toBeVisible();
  await adminMenu.getByRole('link', { name: 'Overview' }).click();
  await expect(
    adminMetrics.getByRole('link', { name: /Bills awaiting payment verification 0/ }),
  ).toBeVisible();
  await adminMetrics.getByRole('link', { name: /Payment-confirmed sales ₹8.00/ }).click();
  await expect(page).toHaveURL(/#confirmed-sales$/);
  await adminMenu.getByRole('link', { name: 'Expenses' }).click();
  await page.getByLabel('Expense name').fill('Detergent');
  await page.getByLabel('Amount').fill('23.50');
  await page.getByRole('button', { name: 'Record expense' }).click();
  await expect(page.getByText('Detergent · ₹23.50')).toBeVisible();
  await adminMenu.getByRole('link', { name: 'Loss & damage' }).click();
  await page
    .getByRole('combobox', { name: 'Client', exact: true })
    .selectOption({ label: 'Second account' });
  await page.getByLabel('Particular').selectOption('Runner');
  await page.getByLabel('Loss or damage details').fill('One torn edge');
  await page.getByRole('button', { name: 'Record incident' }).click();
  await expect(page.getByText(/Second account.*Runner.*One torn edge/)).toBeVisible();
  expect(businessRequests).toEqual([]);
});
