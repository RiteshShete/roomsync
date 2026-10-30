import { expect, test, type Page } from '@playwright/test';
import { threePersonHousehold } from './helpers';

test.describe.configure({ timeout: 120_000 });

async function openList(page: Page) {
  await page.goto('/#/house/groceries');
  await page.reload();
}

async function addItem(page: Page, name: string, quantity?: string) {
  await page.getByRole('button', { name: 'Add grocery' }).first().click();
  await page.getByLabel(/Item name/).fill(name);
  if (quantity) await page.getByLabel(/Quantity/).fill(quantity);
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByText('Item added.')).toBeVisible();
}

test.describe('Journey F: groceries (three real accounts)', () => {
  test('add, purchase, move back, duplicate handling, soft delete with undo', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 13');

    await openList(a.page);
    await expect(a.page.getByText('Nothing on the shopping list')).toBeVisible();
    await addItem(a.page, 'Milk', '2');
    await expect(a.page.getByText('Milk', { exact: false }).first()).toBeVisible();
    await expect(a.page.getByText('added by Asha')).toBeVisible();

    // A same-named item triggers the duplicate prompt; Update existing changes the quantity instead of adding.
    await a.page.getByRole('button', { name: 'Add grocery' }).first().click();
    await a.page.getByLabel(/Item name/).fill('milk');
    await a.page.getByLabel(/Quantity/).fill('3');
    await a.page.getByRole('button', { name: 'Save item' }).click();
    await expect(a.page.getByRole('heading', { name: 'Already on the list' })).toBeVisible();
    await a.page.getByRole('button', { name: 'Update existing' }).click();
    await expect(a.page.getByText('Item updated.')).toBeVisible();
    await expect(a.page.getByText('3', { exact: false }).first()).toBeVisible();
    await expect(a.page.getByRole('checkbox')).toHaveCount(1);

    // Bilal sees it on his own device and buys it.
    await openList(b.page);
    await b.page.getByRole('checkbox', { name: 'Mark Milk as purchased' }).click();
    await expect(b.page.getByText('Milk marked as purchased.')).toBeVisible();
    await expect(b.page.getByText('1 of 1 purchased')).toBeVisible();

    // Asha sees who bought it, then moves it back to Needed.
    await openList(a.page);
    await a.page.getByRole('tab', { name: /Bought/ }).click();
    await expect(a.page.getByText(/bought by Bilal/)).toBeVisible();
    await a.page.getByRole('checkbox', { name: 'Move Milk back to Needed' }).click();
    await expect(a.page.getByText('Milk is back on the list.')).toBeVisible();

    // Soft delete with Undo restores it.
    await a.page.getByRole('tab', { name: /To Buy/ }).click();
    await a.page.getByRole('button', { name: 'Edit Milk' }).click();
    await a.page.getByRole('button', { name: 'Delete item' }).click();
    await expect(a.page.getByText('Milk deleted.')).toBeVisible();
    await a.page.getByRole('button', { name: 'Undo' }).click();
    await expect(a.page.getByText('Milk restored.')).toBeVisible();

    // Chitra can read and add too (any member), proving shared access.
    await openList(c.page);
    await expect(c.page.getByText('Milk', { exact: false }).first()).toBeVisible();

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('two people buy the same item at once: one wins, the other is told and the list refreshes', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 14');

    await openList(a.page);
    await addItem(a.page, 'Eggs', '12');

    // Both open the list with the item still Needed (neither has seen the other's change yet).
    await openList(a.page);
    await openList(b.page);
    const boxA = a.page.getByRole('checkbox', { name: 'Mark Eggs as purchased' });
    const boxB = b.page.getByRole('checkbox', { name: 'Mark Eggs as purchased' });
    await expect(boxA).toBeVisible();
    await expect(boxB).toBeVisible();

    await boxA.click();
    await expect(a.page.getByText('Eggs marked as purchased.')).toBeVisible();

    // Bilal's tab is stale; his tick is rejected by the version check and he sees the explanation.
    await boxB.click();
    await expect(b.page.getByText('Someone else already updated this item. We refreshed the list.')).toBeVisible();
    // After the refresh the item shows as bought by Asha.
    await b.page.getByRole('tab', { name: /Bought/ }).click();
    await expect(b.page.getByText(/bought by Asha/)).toBeVisible();

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });
});
