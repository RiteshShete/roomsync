import { expect, test } from '@playwright/test';
import { reloadAt, threePersonHousehold } from './helpers';

test.describe.configure({ timeout: 120_000 });

const iso = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test.describe('Journey E: chores (three real accounts)', () => {
  test('recurring chore with rotation: complete, next goes to the next person, undo, and a plain member cannot complete someone else’s', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 11');

    // Asha creates a weekly chore due today, rotating Asha → Bilal → Chitra.
    await a.page.goto('/#/chores/new');
    await a.page.getByLabel('What needs doing?').fill('Take out the trash');
    await a.page.getByLabel('Assign to').selectOption({ label: 'Asha (You)' });
    await a.page.getByLabel('Due date').fill(iso(0));
    await a.page.getByLabel('Repeats').selectOption({ label: 'Weekly' });
    await a.page.getByRole('switch', { name: 'Rotate between housemates' }).click();
    // The default order is member join order; make it explicit by checking the visible order line.
    await expect(a.page.getByText(/Order: /)).toContainText('Asha');
    await a.page.getByRole('button', { name: 'Save chore' }).click();
    await expect(a.page.getByText('Chore created.')).toBeVisible();
    await expect(a.page.getByText('Take out the trash', { exact: true })).toBeVisible();

    // Bilal (plain member, not the assignee) sees the chore but cannot complete it: disabled with a reason.
    await reloadAt(b.page, '/chores');
    const bRow = b.page.getByRole('listitem').filter({ hasText: 'Take out the trash' });
    await expect(bRow).toBeVisible();
    await expect(bRow.getByRole('button', { name: 'Mark as done' })).toHaveAttribute('aria-disabled', 'true');

    // Asha completes it. The next occurrence goes to the next person in the rotation.
    await a.page.getByRole('button', { name: 'Mark as done' }).click();
    await expect(a.page.getByText('Nice work — task completed.')).toBeVisible();
    await expect(a.page.getByText(/Next up: Bilal\./)).toBeVisible();

    // The next occurrence (due next week) is assigned to Bilal, who sees it as his own on his device.
    await reloadAt(b.page, '/chores');
    const next = b.page.getByRole('listitem').filter({ hasText: 'Take out the trash' });
    await expect(next).toContainText('Assigned to You');
    await expect(next).toContainText('Weekly');

    // Completed history shows who did it.
    await reloadAt(a.page, '/chores/completed');
    await expect(a.page.getByText(/Completed by You/)).toBeVisible();

    // Undo: allowed because the follow-up occurrence has not been completed.
    await a.page.getByRole('listitem').filter({ hasText: 'Take out the trash' }).getByRole('button', { name: 'Undo' }).click();
    await expect(a.page.getByText('Chore reopened.')).toBeVisible();

    // Reopening cancelled the untouched follow-up occurrence, so the chore is back for everyone.
    await reloadAt(c.page, '/chores');
    const cRow = c.page.getByRole('listitem').filter({ hasText: 'Take out the trash' });
    await expect(cRow).toHaveCount(1);
    await expect(cRow.getByRole('button', { name: 'Mark as done' })).toHaveAttribute('aria-disabled', 'true');
    await reloadAt(b.page, '/chores/mine');
    await expect(b.page.getByRole('listitem').filter({ hasText: 'Take out the trash' })).toHaveCount(0);

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('an admin can edit and cancel a chore; a failed edit keeps what was typed', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 12');

    await a.page.goto('/#/chores/new');
    await a.page.getByLabel('What needs doing?').fill('Water plants');
    await a.page.getByLabel('Due date').fill(iso(0));
    await a.page.getByRole('button', { name: 'Save chore' }).click();
    await expect(a.page.getByText('Chore created.')).toBeVisible();

    await a.page.getByRole('link', { name: 'Edit' }).first().click();
    const title = a.page.getByLabel('What needs doing?');
    await expect(title).toHaveValue('Water plants');
    // Save is disabled with a reason until something changes.
    await expect(a.page.getByRole('button', { name: 'Save chore' })).toHaveAttribute('aria-disabled', 'true');
    await title.fill('Water the plants');

    // Offline: the save fails, the form keeps the typed value.
    await a.context.setOffline(true);
    await a.page.getByRole('button', { name: 'Save chore' }).click();
    await expect(a.page.getByRole('alert')).toBeVisible();
    await expect(title).toHaveValue('Water the plants');
    await a.context.setOffline(false);
    await a.page.getByRole('button', { name: 'Save chore' }).click();
    await expect(a.page.getByText('Chore updated.')).toBeVisible();
    await expect(a.page.getByText('Water the plants', { exact: true })).toBeVisible();

    // Cancel it (confirmed); it leaves the lists.
    await a.page.getByRole('link', { name: 'Edit' }).first().click();
    await a.page.getByRole('button', { name: 'Cancel chore' }).click();
    await a.page.getByRole('dialog').getByRole('button', { name: 'Cancel chore' }).click();
    await expect(a.page.getByText('Chore cancelled.')).toBeVisible();
    await reloadAt(b.page, '/chores');
    await expect(b.page.getByText('Water the plants', { exact: true })).toHaveCount(0);

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });
});
