import { expect, test, type Locator, type Page } from '@playwright/test';
import { addEqualExpense, threePersonHousehold } from './helpers';

test.describe.configure({ timeout: 300_000 });

const SAVE_FAILED = /couldn.t save that change\. Your information is still here/;
const OFFLINE = /couldn.t reach RoomSync/;

type Failure = 'server' | 'network';

/**
 * Makes matching requests fail. `server` answers 500 with an unexpected body (an RPC or table write blowing
 * up); `network` drops the connection. Returns a function that lets requests through again.
 */
async function breakRequests(page: Page, url: RegExp, method: 'POST' | 'PATCH', kind: Failure): Promise<() => Promise<void>> {
  const handler = (route: import('@playwright/test').Route) => {
    if (route.request().method() !== method) return route.fallback();
    return kind === 'server'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'XX000', message: 'internal error', details: null, hint: null }) })
      : route.abort('internetdisconnected');
  };
  await page.route(url, handler);
  return () => page.unroute(url, handler);
}

/**
 * The contract for every save: a server error says "couldn't save, your information is still here", a dropped
 * connection says it couldn't reach RoomSync, neither clears what was typed, and the same click works once the
 * problem is gone.
 */
async function expectSurvivesFailures(opts: {
  page: Page;
  label: string;
  url: RegExp;
  method: 'POST' | 'PATCH';
  submit: () => Promise<void>;
  typed: { field: Locator; value: string }[];
  success: () => Promise<void>;
}) {
  const { page, label, url, method, submit, typed, success } = opts;
  const keptValues = async (when: string) => {
    for (const { field, value } of typed) await expect(field, `${label}: ${when}, "${value}" is still in the field`).toHaveValue(value);
  };

  const stop500 = await breakRequests(page, url, method, 'server');
  await submit();
  await expect(page.getByRole('alert').filter({ hasText: SAVE_FAILED }).first(), `${label}: server error message`).toBeVisible();
  await keptValues('after a server error');
  await stop500();

  const stopNet = await breakRequests(page, url, method, 'network');
  await submit();
  await expect(page.getByRole('alert').filter({ hasText: OFFLINE }).first(), `${label}: offline message`).toBeVisible();
  await keptValues('after a dropped connection');
  await stopNet();

  await submit();
  await success();
}

test.describe('Failure injection: forms keep what was typed', () => {
  test('expense, settlement, chore, grocery, announcement, profile, preferences and settings', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat Failures');
    const page = a.page;

    // ---- add expense (RPC add_expense)
    await page.goto('/#/expenses/new');
    const title = page.getByLabel('What was this for?');
    const amount = page.getByLabel(/Total amount/);
    await title.fill('Dinner');
    await amount.fill('900');
    await expectSurvivesFailures({
      page,
      label: 'add expense',
      url: /\/rest\/v1\/rpc\/add_expense/,
      method: 'POST',
      submit: () => page.getByRole('button', { name: 'Save expense' }).click(),
      typed: [
        { field: title, value: 'Dinner' },
        { field: amount, value: '900' },
      ],
      success: () => expect(page.getByText('Expense saved.')).toBeVisible(),
    });

    // ---- record settlement (RPC record_settlement), from Bilal's suggested payment
    await b.page.goto('/#/expenses/balances');
    await b.page.reload();
    await b.page.getByRole('link', { name: 'Record this payment' }).first().click();
    const note = b.page.getByLabel(/Note or reference/);
    await note.fill('UPI ref 42');
    await b.page.getByRole('button', { name: 'Review' }).click();
    await expectSurvivesFailures({
      page: b.page,
      label: 'record settlement',
      url: /\/rest\/v1\/rpc\/record_settlement/,
      method: 'POST',
      submit: () => b.page.getByRole('button', { name: 'Record settlement' }).click(),
      typed: [],
      success: () => expect(b.page.getByRole('heading', { name: 'Settlement recorded' })).toBeVisible(),
    });

    // ---- create chore (table insert)
    await page.goto('/#/chores/new');
    const chore = page.getByLabel('What needs doing?');
    await chore.fill('Recycling');
    await expectSurvivesFailures({
      page,
      label: 'create chore',
      url: /\/rest\/v1\/chores/,
      method: 'POST',
      submit: () => page.getByRole('button', { name: 'Save chore' }).click(),
      typed: [{ field: chore, value: 'Recycling' }],
      success: () => expect(page.getByText('Chore created.')).toBeVisible(),
    });

    // ---- add grocery (table insert, in a sheet)
    await page.goto('/#/house/groceries');
    await page.getByRole('button', { name: 'Add grocery' }).first().click();
    const item = page.getByLabel(/Item name/);
    const itemNote = page.getByLabel(/^Note/);
    await item.fill('Milk');
    await itemNote.fill('full cream');
    await expectSurvivesFailures({
      page,
      label: 'add grocery',
      url: /\/rest\/v1\/grocery_items/,
      method: 'POST',
      submit: () => page.getByRole('button', { name: 'Save item' }).click(),
      typed: [
        { field: item, value: 'Milk' },
        { field: itemNote, value: 'full cream' },
      ],
      success: () => expect(page.getByText('Item added.')).toBeVisible(),
    });

    // ---- post announcement (table insert, in a sheet)
    await page.goto('/#/house/announcements');
    await page.getByRole('button', { name: 'Post announcement' }).first().click();
    const heading = page.getByLabel('Title');
    const message = page.getByLabel('Message');
    await heading.fill('Water off');
    await message.fill('Tuesday 10 to 12');
    await expectSurvivesFailures({
      page,
      label: 'post announcement',
      url: /\/rest\/v1\/announcements/,
      method: 'POST',
      submit: () => page.getByRole('button', { name: 'Post', exact: true }).click(),
      typed: [
        { field: heading, value: 'Water off' },
        { field: message, value: 'Tuesday 10 to 12' },
      ],
      success: () => expect(page.getByText('Announcement posted.')).toBeVisible(),
    });

    // ---- profile (table update)
    await page.goto('/#/you/profile');
    const name = page.getByLabel('Your name');
    await name.fill('Asha K');
    await expectSurvivesFailures({
      page,
      label: 'profile',
      url: /\/rest\/v1\/profiles/,
      method: 'PATCH',
      submit: () => page.getByRole('button', { name: 'Save changes' }).click(),
      typed: [{ field: name, value: 'Asha K' }],
      success: () => expect(page.getByText('Profile updated.')).toBeVisible(),
    });

    // ---- notification preferences (table update); the switch must stay switched
    await page.goto('/#/you/notifications');
    const chores = page.getByRole('switch', { name: 'Chores' });
    await chores.click();
    const stop500 = await breakRequests(page, /\/rest\/v1\/notification_prefs/, 'PATCH', 'server');
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(page.getByRole('alert').filter({ hasText: SAVE_FAILED }).first()).toBeVisible();
    await expect(chores, 'preferences: the switch stays off after a failed save').toHaveAttribute('aria-checked', 'false');
    await stop500();
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(page.getByText('Preferences saved.')).toBeVisible();

    // ---- household settings (RPC update_household)
    await page.goto('/#/you/household');
    const house = page.getByLabel('Household name');
    await house.fill('Flat Failures 2');
    await expectSurvivesFailures({
      page,
      label: 'household settings',
      url: /\/rest\/v1\/rpc\/update_household/,
      method: 'POST',
      submit: () => page.getByRole('button', { name: 'Save changes' }).click(),
      typed: [{ field: house, value: 'Flat Failures 2' }],
      success: () => expect(page.getByText('Settings saved.')).toBeVisible(),
    });

    // ---- move out (RPC start_move_out): date, note and the tick all survive
    await addEqualExpense(c.page, 'Snacks', '300');
    await c.page.goto('/#/you/household/leave');
    await c.page.getByRole('button', { name: /Review what.s outstanding/ }).click();
    const when = c.page.getByLabel('Leaving date');
    const flag = c.page.getByLabel('Note for your housemates');
    await flag.fill('Deposit to discuss');
    const date = await when.inputValue();
    const tick = c.page.getByRole('checkbox', { name: 'I understand what happens when I leave.' });
    await tick.check();
    const stopMove = await breakRequests(c.page, /\/rest\/v1\/rpc\/start_move_out/, 'POST', 'server');
    await c.page.getByRole('button', { name: 'Leave household' }).click();
    await expect(c.page.getByRole('alert').filter({ hasText: SAVE_FAILED }).first()).toBeVisible();
    await expect(flag).toHaveValue('Deposit to discuss');
    await expect(when).toHaveValue(date);
    await expect(tick).toBeChecked();
    await stopMove();
    await c.page.getByRole('button', { name: 'Leave household' }).click();
    await expect(c.page.getByRole('heading', { name: /You.re moving out/ })).toBeVisible();

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('actions that are not forms say so and change nothing: ticking a grocery, marking a chore done', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat Failures B');
    const page = a.page;
    await page.goto('/#/house/groceries');
    await page.getByRole('button', { name: 'Add grocery' }).first().click();
    await page.getByLabel(/Item name/).fill('Eggs');
    await page.getByRole('button', { name: 'Save item' }).click();
    await expect(page.getByText('Item added.')).toBeVisible();

    const stop = await breakRequests(page, /\/rest\/v1\/grocery_items/, 'PATCH', 'server');
    const box = page.getByRole('checkbox', { name: 'Mark Eggs as purchased' });
    await box.click();
    await expect(page.getByRole('alert').filter({ hasText: /./ }).first()).toBeVisible();
    await expect(box, 'the item is still on the Needed list, unticked').not.toBeChecked();
    await stop();
    await box.click();
    await expect(page.getByText('Eggs marked as purchased.')).toBeVisible();
    await Promise.all([a, b, c].map((u) => u.context.close()));
  });
});
