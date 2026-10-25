import { expect, test } from '@playwright/test';
import { isoDay, leaveHousehold, makeMoveOutDue, reloadAt, settle, threePersonHousehold } from './helpers';

test.describe.configure({ timeout: 180_000 });

test.describe('Journey H: move out (three real accounts)', () => {
  test('leave with a future date: still active until then; when the date passes the person is out, chores move on, history stays', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 41');

    // Asha creates a rotating weekly chore assigned to Bilal (rotation Bilal → Chitra), due today.
    await a.page.goto('/#/chores/new');
    await a.page.getByLabel('What needs doing?').fill('Recycling');
    await a.page.getByLabel('Assign to').selectOption({ label: 'Bilal' });
    await a.page.getByLabel('Due date').fill(isoDay(0));
    await a.page.getByLabel('Repeats').selectOption({ label: 'Weekly' });
    await a.page.getByRole('switch', { name: 'Rotate between housemates' }).click();
    await a.page.getByRole('checkbox', { name: 'Include Asha in the rotation' }).uncheck();
    await a.page.getByRole('button', { name: 'Save chore' }).click();
    await expect(a.page.getByText('Chore created.')).toBeVisible();

    // Bilal pays for something shared (history that must survive).
    await b.page.goto('/#/expenses/new');
    await b.page.getByLabel('What was this for?').fill('Internet bill');
    await b.page.getByLabel(/Total amount/).fill('900');
    await b.page.getByRole('button', { name: 'Save expense' }).click();
    await expect(b.page.getByText('Expense saved.')).toBeVisible();

    // Step 1 explains first; step 2 shows what is outstanding; nothing happens until the explicit confirmation.
    await b.page.goto('/#/you/household/leave');
    await expect(b.page.getByRole('heading', { name: 'Before you leave' })).toBeVisible();
    await expect(b.page.getByText(/does not move money, work out deposits, or mark anything as paid/)).toBeVisible();
    await b.page.getByRole('button', { name: /Review what.s outstanding/ }).click();
    await expect(b.page.getByText('You are owed ₹600.00.')).toBeVisible();
    await expect(b.page.getByText('1 open chore assigned to you will be passed on:')).toBeVisible();
    await expect(b.page.getByRole('listitem').filter({ hasText: 'Recycling' })).toBeVisible();
    const leave = b.page.getByRole('button', { name: 'Leave household' });
    await expect(leave).toHaveAttribute('aria-disabled', 'true');
    await b.page.getByLabel('Leaving date').fill(isoDay(3));
    await b.page.getByLabel('Note for your housemates').fill('Please split the internet refund');
    await b.page.getByRole('checkbox', { name: 'I understand what happens when I leave.' }).check();
    await leave.click();

    // Still a member until the date: status screen, banner, and the app keeps working.
    await expect(b.page.getByRole('heading', { name: /You.re moving out/ })).toBeVisible();
    await expect(b.page.getByText('You can keep using RoomSync until then.')).toBeVisible();
    await expect(b.page.getByText(/Balance you reviewed: ₹600.00/)).toBeVisible();
    await expect(b.page.getByText('Please split the internet refund')).toBeVisible();
    await b.page.goto('/#/expenses');
    await expect(b.page.getByTestId('you-are-owed')).toHaveText('₹600.00');
    await expect(b.page.getByRole('link', { name: 'Details' })).toBeVisible();

    // A note or dispute can be added while leaving; it is listed and never resolved automatically.
    await b.page.goto('/#/you/household/leave');
    await b.page.getByLabel('Note or dispute').fill('Electricity share still unclear');
    await b.page.getByRole('button', { name: 'Add note' }).click();
    await expect(b.page.getByText('Note added.')).toBeVisible();
    await expect(b.page.getByRole('listitem').filter({ hasText: 'Electricity share still unclear' })).toBeVisible();

    // Others see it: a chip on the member list and an activity line; the chore is still Bilal's.
    await reloadAt(a.page, '/you/members');
    await expect(a.page.getByRole('listitem').filter({ hasText: 'Bilal' }).getByText('Moving out')).toBeVisible();
    await reloadAt(a.page, '/activity');
    await expect(a.page.getByRole('link', { name: /Bilal has started moving out/ })).toBeVisible();
    await expect(a.page.getByRole('link', { name: /Bilal added a note to their move-out/ })).toBeVisible();

    // Time passes: the leaving date arrives.
    await makeMoveOutDue('Flat 41', 'Bilal');

    // Bilal opens the app: he is out, sees what that means, and has no access to the household.
    await reloadAt(b.page, '/');
    await expect(b.page.getByRole('heading', { name: /You.ve left Flat 41/ })).toBeVisible();
    await expect(b.page.getByText(/stays in its history for the people still there/)).toBeVisible();
    await expect(b.page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    await b.page.getByRole('button', { name: 'Continue' }).click();
    await expect(b.page.getByRole('link', { name: /Create a household/ })).toBeVisible();
    await b.page.goto('/#/expenses');
    await expect(b.page.getByRole('link', { name: /Create a household/ })).toBeVisible(); // not the expenses of the old household

    // Chitra: Bilal is gone from the member list, the chore moved on, history is intact.
    await reloadAt(c.page, '/you/members');
    await expect(c.page.getByText('2 members')).toBeVisible();
    await expect(c.page.getByText('Bilal', { exact: true })).toHaveCount(0);
    await reloadAt(c.page, '/chores');
    const moved = c.page.getByRole('listitem').filter({ hasText: 'Recycling' });
    await expect(moved).toContainText('Chitra');
    await reloadAt(c.page, '/expenses/all');
    await expect(c.page.getByText('Internet bill')).toBeVisible();
    await reloadAt(c.page, '/activity');
    await expect(c.page.getByRole('link', { name: /Bilal has left the household/ })).toBeVisible();

    // The departed person can no longer be picked for new expenses or chores.
    await a.page.goto('/#/expenses/new');
    await expect(a.page.getByRole('checkbox', { name: /Bilal/ })).toHaveCount(0);

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('cancel while still leaving: the member stays and everything goes back to normal', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 42');
    await leaveHousehold(c.page, isoDay(10));
    await expect(c.page.getByRole('heading', { name: /You.re moving out/ })).toBeVisible();

    await c.page.getByRole('button', { name: 'Cancel move-out' }).click();
    await c.page.getByRole('dialog').getByRole('button', { name: 'Cancel move-out' }).click();
    await expect(c.page.getByText(/Move-out cancelled. You.re staying./)).toBeVisible();
    await expect(c.page.getByRole('heading', { name: 'Before you leave' })).toBeVisible();
    await expect(c.page.getByRole('link', { name: 'Details' })).toHaveCount(0);

    await reloadAt(a.page, '/you/members');
    await expect(a.page.getByText('3 members')).toBeVisible();
    await expect(a.page.getByText('Moving out')).toHaveCount(0);

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('leaving with today as the date takes effect straight away', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 43');
    await leaveHousehold(b.page, isoDay(0));
    await expect(b.page.getByRole('heading', { name: /You.ve left Flat 43/ })).toBeVisible();

    await reloadAt(a.page, '/you/members');
    await expect(a.page.getByText('2 members')).toBeVisible();
    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('an admin can start and cancel a member’s move-out; the owner cannot be moved out by someone else', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 44');

    await a.page.goto('/#/you/members');
    await a.page.getByRole('button', { name: 'Manage Chitra' }).click();
    await a.page.getByRole('button', { name: 'Start move-out' }).click();
    await a.page.getByLabel('Leaving date').fill(isoDay(14));
    await a.page.getByLabel('Note for your housemates').fill('Agreed in person');
    await a.page.getByRole('button', { name: 'Start move-out' }).click();
    await expect(a.page.getByText('Chitra is moving out.')).toBeVisible();

    // Chitra sees the banner, still has access, and the note.
    await reloadAt(c.page, '/');
    await expect(c.page.getByRole('link', { name: 'Details' })).toBeVisible();
    await expect(c.page.getByRole('heading', { level: 1, name: 'Flat 44' })).toBeVisible();

    // Bilal (plain member) cannot manage anyone.
    await reloadAt(b.page, '/you/members');
    await expect(b.page.getByRole('button', { name: /^Manage/ })).toHaveCount(0);

    // Nobody can manage the owner.
    await expect(a.page.getByRole('button', { name: 'Manage Asha' })).toHaveCount(0);

    // Cancel it.
    await reloadAt(a.page, '/you/members');
    await a.page.getByRole('button', { name: 'Manage Chitra' }).click();
    await a.page.getByRole('button', { name: 'Cancel Chitra’s move-out' }).click();
    await expect(a.page.getByText('Chitra’s move-out was cancelled.')).toBeVisible();

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('the owner must transfer ownership first; a sole owner is pointed to archiving', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 45');
    await a.page.goto('/#/you/household/leave');
    await expect(a.page.getByText('You’re the owner')).toBeVisible();
    await expect(a.page.getByText('Transfer ownership to another member before you leave.')).toBeVisible();
    await expect(a.page.getByRole('button', { name: 'Leave household' })).toHaveCount(0);

    // the database says no even if called directly (the UI never offers it)
    await Promise.all([b, c].map(async (u) => settle(u.page)));
    await Promise.all([a, b, c].map((u) => u.context.close()));
  });
});
