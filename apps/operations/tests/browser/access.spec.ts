import { test, expect } from '@playwright/test';
test('anonymous workspace navigation never exposes master data', async ({ page }) => {
  await page.goto('/workspace');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
});
test('login and recovery are keyboard-usable without a fake demo account', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Username or email')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Forgot your password/ }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password.' })).toBeVisible({
    timeout: 25000,
  });
});
test('staff can open and submit the account request form', async ({ page }) => {
  await page.route('**/api/auth/register', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      displayName: 'Registration Test',
      login: 'registration@shreesudhayalaudary',
      contactPhone: '+91 98765 43210',
    });
    await route.fulfill({
      json: { data: { message: 'Request submitted for Admin approval.' } },
    });
  });
  await page.goto('/login');
  await expect(page.getByRole('img', { name: 'Shree Sudhya Laundry Services' })).toBeVisible();
  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible({
    timeout: 25000,
  });
  await page.getByLabel('Full name').fill('Registration Test');
  await page.getByLabel('Username or email').fill('registration@shreesudhayalaudary');
  const phone = page.getByLabel('Contact phone');
  await expect(phone).not.toHaveAttribute('required');
  await phone.fill('+91 98765 43210');
  const confirmation = page.getByLabel('Confirm password', { exact: true });
  await page.getByRole('button', { name: 'Show confirmation password' }).click();
  await expect(confirmation).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide confirmation password' }).click();
  await expect(confirmation).toHaveAttribute('type', 'password');
  if (await page.getByRole('button', { name: 'Submit for approval' }).isDisabled()) {
    await expect(
      page.getByText('Registration is currently unavailable.', { exact: false }),
    ).toBeVisible();
    return;
  }
  await page.getByLabel('Password', { exact: true }).fill('test-password-123');
  await page.getByLabel('Confirm password').fill('different-test-password');
  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(page.getByRole('status')).toContainText('passwords must match');
  await page.getByLabel('Confirm password').fill('test-password-123');
  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(page.getByRole('status')).toContainText('Admin approval');
  await expect(page).toHaveURL(/register/);
});
// Persisted master acceptance requires explicitly supplied invited accounts and test database.
// This test is gated rather than fabricating a successful authenticated browser journey.
test('invited admin creates client and two branches', async ({ page }) => {
  test.skip(
    !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
    'Set test-only invited Admin credentials and isolated DB as documented.',
  );
  await page.goto('/login');
  await page.getByLabel('Username or email').fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: /Sign in securely/ }).click();
  await expect(page).toHaveURL(/workspace/);
  await page.goto('/workspace/masters/clients/new');
  const client = `Fictional browser client ${Date.now()}`;
  await page.getByLabel('Name *', { exact: true }).fill(client);
  await page.getByRole('button', { name: /Save record/ }).click();
  await expect(page.getByRole('heading', { name: client })).toBeVisible();
  for (const name of ['Fictional branch one', 'Fictional branch two']) {
    await page.goto('/workspace/masters/branches/new');
    await page.getByLabel('Name *', { exact: true }).fill(name);
    await page.getByLabel('Client search').fill(client);
    await expect(page.getByRole('option', { name: client, exact: true })).toBeAttached();
    await page.getByLabel('Client *', { exact: true }).selectOption({ label: client });
    await page.getByRole('button', { name: /Save record/ }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }
  const openNavigation = page.getByRole('button', { name: 'Open navigation' });
  if (await openNavigation.isVisible()) await openNavigation.click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
});
