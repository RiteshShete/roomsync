import { expect, test } from '@playwright/test';
import { createHouseholdWithInvite, joinWithCode, newUser } from './helpers';

test.describe('Journeys A and B: create, invite, join (two real accounts)', () => {
  test('user A creates a household and invites; user B joins; both see two members', async ({ browser }) => {
    const a = await newUser(browser, 'Alice');
    const b = await newUser(browser, 'Bob');

    // Journey A: create (name only), invite, continue before anyone joins.
    const code = await createHouseholdWithInvite(a.page, 'Flat 4B');
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    await expect(a.page.getByText('Just you so far')).toBeVisible();

    // Journey B: preview shows name and count only, then join.
    await joinWithCode(b.page, code);
    await expect(b.page.getByRole('heading', { name: 'Flat 4B' })).toBeVisible();
    await expect(b.page.getByText('1 member', { exact: true })).toBeVisible();
    await expect(b.page.getByText('Alice')).toHaveCount(0); // no member identities before joining
    await b.page.getByRole('button', { name: 'Join household' }).click();
    await expect(b.page.getByRole('heading', { level: 1, name: 'Flat 4B' })).toBeVisible();

    // Both see two members.
    for (const user of [a, b]) {
      await user.page.goto('/#/you/members');
      await expect(user.page.getByText('2 members', { exact: true })).toBeVisible();
      await expect(user.page.getByText('Alice', { exact: false }).first()).toBeVisible();
      await expect(user.page.getByText('Bob', { exact: false }).first()).toBeVisible();
    }
    await expect(a.page.getByRole('listitem').filter({ hasText: 'Alice' }).getByText('Owner')).toBeVisible();
    await expect(a.page.getByRole('listitem').filter({ hasText: 'Bob' }).getByText('Member')).toBeVisible();

    // The new member only gets view access to management (UX; RLS enforces it).
    await expect(b.page.getByRole('button', { name: /^Manage/ })).toHaveCount(0);
    await expect(a.page.getByRole('button', { name: 'Manage Bob' })).toBeVisible();

    await a.context.close();
    await b.context.close();
  });

  test('invalid codes explain themselves: unknown, malformed, and revoked', async ({ browser }) => {
    const a = await newUser(browser, 'Cara');
    const b = await newUser(browser, 'Dev');
    const code = await createHouseholdWithInvite(a.page, 'Studio');

    await b.page.getByRole('link', { name: /Join a household/ }).click();
    await b.page.getByLabel('Invite code').fill('abc');
    await b.page.getByRole('button', { name: 'Check code' }).click();
    await expect(b.page.getByRole('alert')).toContainText('8 letters and numbers');

    await b.page.getByLabel('Invite code').fill('ZZZZ-2222');
    await b.page.getByRole('button', { name: 'Check code' }).click();
    await expect(b.page.getByRole('alert')).toContainText('no longer valid');
    await expect(b.page.getByLabel('Invite code')).toHaveValue('ZZZZ-2222');

    // A cancels the invite; B's valid-looking code is now refused with the "cancelled" message.
    await a.page.goto('/#/you/invites');
    await a.page.getByRole('button', { name: 'Cancel invite' }).click();
    await a.page.getByRole('dialog').getByRole('button', { name: 'Cancel invite' }).click();
    await expect(a.page.getByText('Invite cancelled.')).toBeVisible();

    await b.page.getByLabel('Invite code').fill(code);
    await b.page.getByRole('button', { name: 'Check code' }).click();
    await expect(b.page.getByRole('alert')).toContainText('cancelled');

    await a.context.close();
    await b.context.close();
  });

  test('a code is single-household: a member cannot join a second household', async ({ browser }) => {
    const a = await newUser(browser, 'Esha');
    const b = await newUser(browser, 'Farid');
    const codeA = await createHouseholdWithInvite(a.page, 'House E');
    await createHouseholdWithInvite(b.page, 'House F');

    // Farid already belongs to a household: the join screen sends him home instead of letting him try.
    await b.page.goto(`/#/start/join?code=${codeA}`);
    await expect(b.page.getByRole('heading', { level: 1, name: 'House F' })).toBeVisible();

    await a.context.close();
    await b.context.close();
  });
});

test.describe('Roles, ownership and archiving', () => {
  test('owner promotes, transfers ownership, and archives; archived state disables writes', async ({ browser }) => {
    const a = await newUser(browser, 'Gita');
    const b = await newUser(browser, 'Hari');
    const code = await createHouseholdWithInvite(a.page, 'House G');
    await joinWithCode(b.page, code);
    await b.page.getByRole('button', { name: 'Join household' }).click();
    await expect(b.page.getByRole('heading', { level: 1, name: 'House G' })).toBeVisible();

    // Promote Hari to admin; he can now see the invitations page and create a code.
    await a.page.goto('/#/you/members');
    await a.page.getByRole('button', { name: 'Manage Hari' }).click();
    await a.page.getByRole('button', { name: 'Make admin' }).click();
    await expect(a.page.getByText('Hari is now an admin.')).toBeVisible();
    await b.page.goto('/#/you/invites');
    await b.page.reload();
    await expect(b.page.getByRole('button', { name: /Create (new )?invite/ })).toBeVisible();

    // Transfer ownership to Hari after confirming the consequences.
    await a.page.getByRole('button', { name: 'Manage Hari' }).click();
    await a.page.getByRole('button', { name: 'Make owner' }).click();
    await expect(a.page.getByRole('dialog')).toContainText('You’ll become an admin');
    await a.page.getByRole('button', { name: 'Transfer ownership' }).click();
    await expect(a.page.getByText('Hari is now the owner.')).toBeVisible();
    await expect(a.page.getByRole('button', { name: /^Manage/ })).toHaveCount(0); // Gita is an admin now

    // Gita can no longer archive; Hari (owner) can, after the warning.
    await a.page.goto('/#/you/household');
    await expect(a.page.getByRole('button', { name: 'Archive household' })).toHaveAttribute('aria-disabled', 'true');
    await b.page.goto('/#/you/household');
    await b.page.reload();
    await b.page.getByRole('button', { name: 'Archive household' }).click();
    await expect(b.page.getByRole('dialog')).toContainText('Nothing is deleted');
    await b.page.getByRole('dialog').getByRole('button', { name: 'Archive household' }).click();
    await expect(b.page.getByText('Household archived.')).toBeVisible();
    await expect(b.page.getByText('This household is archived. Changes are turned off')).toBeVisible();

    // Writes are off for everyone; the reason is on screen.
    await a.page.goto('/#/you/invites');
    await a.page.reload();
    await expect(a.page.getByRole('button', { name: /Create (new )?invite/ })).toHaveAttribute('aria-disabled', 'true');
    await expect(a.page.getByText('This household is archived, so changes are turned off.').first()).toBeVisible();

    // The owner restores it.
    await b.page.getByRole('button', { name: 'Restore household' }).click();
    await expect(b.page.getByText('Household restored.')).toBeVisible();

    await a.context.close();
    await b.context.close();
  });

  test('settings: owner edits the name; the change shows for the other member', async ({ browser }) => {
    const a = await newUser(browser, 'Ila');
    const b = await newUser(browser, 'Jay');
    const code = await createHouseholdWithInvite(a.page, 'House I');
    await joinWithCode(b.page, code);
    await b.page.getByRole('button', { name: 'Join household' }).click();
    await expect(b.page.getByRole('heading', { level: 1, name: 'House I' })).toBeVisible();

    await a.page.goto('/#/you/household');
    await a.page.getByLabel('Household name').fill('House I (renamed)');
    await a.page.getByRole('button', { name: 'Save changes' }).click();
    await expect(a.page.getByText('Settings saved.')).toBeVisible();

    await b.page.reload();
    await expect(b.page.getByRole('heading', { level: 1, name: 'House I (renamed)' })).toBeVisible();

    // Jay is a plain member: read-only with the reason shown.
    await b.page.goto('/#/you/household');
    await expect(b.page.getByText('Only the owner and admins can change these settings.')).toBeVisible();
    await expect(b.page.getByLabel('Household name')).toHaveAttribute('readonly', '');

    await a.context.close();
    await b.context.close();
  });
});
