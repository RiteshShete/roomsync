import { expect, test } from '@playwright/test';
import { addEqualExpense, localKeys, threePersonHousehold, youAreOwed, youOwe } from './helpers';

test.describe.configure({ timeout: 120_000 });

test.describe('Journeys C and D: expenses and settlements (three real accounts)', () => {
  test('₹1,000 across three people, balances, a recorded settlement, and an edit after it', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 9');

    // Asha adds ₹1,000 split equally three ways; the preview shows the exact shares and the rounding.
    await a.page.goto('/#/expenses/new');
    await a.page.getByLabel('What was this for?').fill('Dinner');
    await a.page.getByLabel(/Total amount/).fill('1000');
    const review = a.page.getByRole('region', { name: 'Review split' });
    await expect(review).toContainText('Asha');
    await expect(review).toContainText('₹333.34');
    await expect(review).toContainText('₹0.01 extra assigned to Asha so the total is exact.');
    await a.page.getByRole('button', { name: 'Save expense' }).click();
    await expect(a.page.getByText('Expense saved.')).toBeVisible();

    // Balances are right for everyone: the payer is owed 666.66, the other two owe 333.33 each.
    expect(await youAreOwed(a.page)).toBe('₹666.66');
    expect(await youOwe(b.page)).toBe('₹333.33');
    expect(await youOwe(c.page)).toBe('₹333.33');

    // "Why do I owe this?" adds up to the displayed balance.
    await b.page.goto('/#/expenses/balances');
    await expect(b.page.getByText('Asha', { exact: false }).first()).toBeVisible();
    await b.page.getByRole('button', { name: 'Why do I owe this?' }).click();
    await expect(b.page.getByText('Your share of Dinner')).toBeVisible();
    await expect(b.page.getByTestId('why-total')).toHaveText('−₹333.33');

    // Journey D: Bilal records paying Asha, from the suggestion. The review says RoomSync moves no money.
    await b.page.getByRole('link', { name: 'Record this payment' }).first().click();
    await expect(b.page.getByLabel(/^Amount/)).toHaveValue('333.33');
    await b.page.getByLabel(/Note or reference/).fill('UPI ref 42');
    await b.page.getByRole('button', { name: 'Review' }).click();
    await expect(b.page.getByRole('note')).toHaveText('This records a payment made outside RoomSync. RoomSync does not move money.');
    await b.page.getByRole('button', { name: 'Record settlement' }).click();
    await expect(b.page.getByRole('heading', { name: 'Settlement recorded' })).toBeVisible();
    await expect(b.page.getByTestId('receipt-amount')).toHaveText('₹333.33');

    // Balances update: Bilal is settled, Asha is owed only what Chitra still owes.
    expect(await youOwe(b.page)).toBe('₹0.00');
    expect(await youAreOwed(a.page)).toBe('₹333.33');
    expect(await youOwe(c.page)).toBe('₹333.33');

    // Edit after a settlement: the amount changes and the impact is explained.
    await a.page.goto('/#/expenses/all');
    await a.page.getByText('Dinner').first().click();
    await a.page.getByRole('link', { name: 'Edit' }).click();
    await a.page.getByLabel(/Total amount/).fill('900');
    await a.page.getByRole('button', { name: 'Save expense' }).click();
    await expect(a.page.getByText('Expense updated.')).toBeVisible();
    await expect(a.page.getByRole('heading', { name: 'This edit changed balances' })).toBeVisible();
    await expect(a.page.getByText('Settlements were already recorded')).toBeVisible();
    await expect(a.page.getByText('Change history')).toBeVisible();
    await expect(a.page.getByText('Amount ₹1,000.00 → ₹900.00')).toBeVisible();

    // The new numbers: 300 each. Chitra owes 300. Bilal already paid 333.33, so he is owed 33.33 back,
    // and Asha is owed 266.67 (300 minus the 33.33 she must return). 266.67 + 33.33 = 300, so it nets to zero.
    expect(await youOwe(c.page)).toBe('₹300.00');
    expect(await youAreOwed(b.page)).toBe('₹33.33');
    expect(await youAreOwed(a.page)).toBe('₹266.67');

    await a.context.close();
    await b.context.close();
    await c.context.close();
  });

  test('delete removes it from balances; restoring brings it back', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Dev', 'Esha', 'Farid'], 'Flat 10');
    await addEqualExpense(a.page, 'Cleaning', '300');
    expect(await youOwe(b.page)).toBe('₹100.00');

    await a.page.goto('/#/expenses/all');
    await a.page.getByText('Cleaning').first().click();
    await a.page.getByRole('button', { name: 'Delete' }).click();
    await expect(a.page.getByRole('dialog')).toContainText('stops counting toward balances');
    await a.page.getByRole('dialog').getByRole('button', { name: 'Delete expense' }).click();
    await expect(a.page.getByText('Expense deleted.')).toBeVisible();
    expect(await youOwe(b.page)).toBe('₹0.00');

    // Deleted expenses are hidden by default and shown (marked) with the filter; restore from there.
    await a.page.goto('/#/expenses/all');
    await expect(a.page.getByText('Cleaning')).toHaveCount(0);
    await a.page.getByRole('button', { name: 'Filters' }).click();
    await a.page.getByRole('switch', { name: 'Show deleted expenses' }).click();
    await a.page.getByRole('button', { name: 'Show results' }).click();
    await a.page.getByText('Cleaning').first().click();
    await expect(a.page.getByText(/Deleted by Dev/).first()).toBeVisible();
    await a.page.getByRole('button', { name: 'Restore expense' }).click();
    await expect(a.page.getByText('Expense restored.')).toBeVisible();
    expect(await youOwe(b.page)).toBe('₹100.00');

    await a.context.close();
    await b.context.close();
    await c.context.close();
  });

  test('Undo straight from the delete toast', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Gita', 'Hari', 'Ila'], 'Flat 11');
    await addEqualExpense(a.page, 'Gas', '600');
    await a.page.goto('/#/expenses/all');
    await a.page.getByText('Gas').first().click();
    await a.page.getByRole('button', { name: 'Delete' }).click();
    await a.page.getByRole('dialog').getByRole('button', { name: 'Delete expense' }).click();
    await a.page.getByRole('button', { name: 'Undo' }).click();
    await expect(a.page.getByText('Expense restored.')).toBeVisible();
    expect(await youOwe(b.page)).toBe('₹200.00');
    await a.context.close();
    await b.context.close();
    await c.context.close();
  });

  test('permission denied: a member cannot change another’s expense, in the UI or at the database', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Jay', 'Kavya', 'Lena'], 'Flat 12');
    await addEqualExpense(a.page, 'Rent', '900');

    // UI: Kavya (a plain member) sees disabled controls with the reason, and the edit URL is refused.
    await b.page.goto('/#/expenses/all');
    await b.page.getByText('Rent').first().click();
    await expect(b.page.getByRole('button', { name: 'Edit' })).toHaveAttribute('aria-disabled', 'true');
    await expect(b.page.getByRole('button', { name: 'Delete' })).toHaveAttribute('aria-disabled', 'true');
    const reason = 'Only the person who added this expense, or an owner or admin, can change it.';
    await expect(b.page.getByText(reason).first()).toBeVisible();
    const id = b.page.url().split('/expenses/')[1]!.split('?')[0]!;
    await b.page.goto(`/#/expenses/${id}/edit`);
    await expect(b.page.getByText(reason)).toBeVisible();

    // Database: skipping the UI entirely, the server still says no.
    const { url, key } = localKeys();
    const result = await b.page.evaluate(
      async ({ url, key, id }) => {
        const token = Object.entries(localStorage)
          .map(([k, v]) => (k.endsWith('-auth-token') ? JSON.parse(v).access_token : null))
          .find(Boolean);
        const res = await fetch(`${url}/rest/v1/rpc/delete_expense`, {
          method: 'POST',
          headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_expense_id: id }),
        });
        return { status: res.status, body: await res.json() };
      },
      { url, key, id },
    );
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.body.message).toBe('permission_denied');

    // The expense is untouched.
    await a.page.goto('/#/expenses/all');
    await expect(a.page.getByText('Rent').first()).toBeVisible();
    expect(await youOwe(c.page)).toBe('₹300.00');

    await a.context.close();
    await b.context.close();
    await c.context.close();
  });

  test('a dispute removes a settlement from balances and shows in its own section', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Mira', 'Nikhil', 'Omar'], 'Flat 13');
    await addEqualExpense(a.page, 'Wi-Fi', '300');

    // Nikhil records paying Mira ₹100.
    await b.page.goto('/#/expenses/settle');
    await b.page.getByLabel('Who paid').selectOption({ label: 'Nikhil (you)' });
    await b.page.getByLabel('Who received it').selectOption({ label: 'Mira' });
    await b.page.getByLabel(/^Amount/).fill('100');
    await b.page.getByRole('button', { name: 'Review' }).click();
    await b.page.getByRole('button', { name: 'Record settlement' }).click();
    await expect(b.page.getByRole('heading', { name: 'Settlement recorded' })).toBeVisible();
    expect(await youOwe(b.page)).toBe('₹0.00');

    // Mira (the other party, who did not record it) disputes it; a reason is required.
    await a.page.goto('/#/expenses/settlements');
    await a.page.getByRole('button', { name: 'Dispute' }).click();
    await a.page.getByRole('dialog').getByRole('button', { name: 'Dispute settlement' }).click();
    await expect(a.page.getByRole('dialog').getByRole('alert')).toContainText('Add a reason');
    await a.page.getByLabel('Reason').fill('I did not receive it');
    await a.page.getByRole('dialog').getByRole('button', { name: 'Dispute settlement' }).click();
    await expect(a.page.getByText('Settlement disputed.')).toBeVisible();
    await expect(a.page.getByRole('region', { name: /Disputed/ })).toContainText('I did not receive it');

    // It no longer counts: Nikhil owes the full ₹100 again.
    expect(await youOwe(b.page)).toBe('₹100.00');
    await b.page.goto('/#/expenses/balances');
    await expect(b.page.getByText('1 disputed settlement isn’t counted.', { exact: false })).toBeVisible();

    await a.context.close();
    await b.context.close();
    await c.context.close();
  });
});
