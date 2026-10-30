import { expect, test } from '@playwright/test';
import { addEqualExpense, bell, post, reloadAt, threePersonHousehold } from './helpers';

test.describe.configure({ timeout: 180_000 });

test.describe('Home and the bottom bar (from the Figma design)', () => {
  test('the House Feed shows real money and announcements, collapses, and the housemates link to Members', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 51');

    // Asha pays 900 for three: she is owed 600, the others owe 300 each.
    await addEqualExpense(a.page, 'Dinner', '900');
    await post(b.page, 'Water off Tuesday', 'No water from 10 to 12.');

    await reloadAt(a.page, '/');
    await expect(a.page.getByRole('heading', { level: 2, name: 'House Feed' })).toBeVisible();
    await expect(a.page.getByRole('link', { name: /You are owed ₹600\.00/ })).toBeVisible();
    await expect(a.page.getByRole('link', { name: /Water off Tuesday · Bilal/ })).toBeVisible();

    await reloadAt(b.page, '/');
    await expect(b.page.getByRole('link', { name: /You owe ₹300\.00/ })).toBeVisible();

    // The money line opens Balances; the announcement line opens Announcements.
    await b.page.getByRole('link', { name: /You owe ₹300\.00/ }).click();
    await expect(b.page.getByRole('heading', { level: 1, name: 'Balances' }).or(b.page.getByText('Everyone’s balance'))).toBeVisible();
    await reloadAt(a.page, '/');
    await a.page.getByRole('link', { name: /Water off Tuesday · Bilal/ }).click();
    await expect(a.page.getByRole('heading', { level: 1, name: 'Announcements' })).toBeVisible();

    // Collapse and expand the card with its button (also with the keyboard).
    await a.page.goto('/#/');
    const toggle = a.page.getByRole('button', { name: 'Hide House Feed' });
    await toggle.focus();
    await a.page.keyboard.press('Enter');
    await expect(a.page.getByRole('button', { name: 'Show House Feed' })).toHaveAttribute('aria-expanded', 'false');
    await expect(a.page.getByRole('link', { name: /You are owed/ })).toBeHidden();
    await a.page.getByRole('button', { name: 'Show House Feed' }).click();
    await expect(a.page.getByRole('link', { name: /You are owed/ })).toBeVisible();

    // The avatar cluster is a link to the members.
    await a.page.getByRole('link', { name: '3 members' }).click();
    await expect(a.page.getByRole('heading', { level: 1, name: 'Members' })).toBeVisible();

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('the bell and the activity list are there, and there are no points', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 52');
    await reloadAt(a.page, '/');
    await expect(a.page.getByRole('heading', { level: 2, name: 'House Feed' })).toBeVisible();
    expect(await a.page.locator('body').innerText()).not.toMatch(/contribution points|#1 this week|leaderboard/i);
    await expect(bell(a.page)).toBeVisible();
    await expect(a.page.getByRole('heading', { level: 2, name: 'Activity' })).toBeAttached();
    await expect(a.page.getByRole('link', { name: 'See all activity' })).toHaveAttribute('href', '#/activity');
    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('the household chat: messages reach the others live, failures keep the text, and other households cannot see them', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 55');
    await reloadAt(a.page, '/');
    await reloadAt(b.page, '/');
    await b.page.getByRole('tab', { name: 'Message' }).click();
    await expect(b.page.getByText('No messages yet')).toBeVisible();

    await a.page.getByRole('tab', { name: 'Message' }).click();
    await a.page.getByLabel('Your message').fill('Who is buying milk?');
    await a.page.getByRole('button', { name: 'Send message' }).click();
    await expect(a.page.getByRole('log').getByText('Who is buying milk?')).toBeVisible();
    await expect(a.page.getByLabel('Your message')).toHaveValue('');

    // Bilal sees it without reloading, with the sender's name.
    await expect(b.page.getByRole('log').getByText('Who is buying milk?')).toBeVisible();
    await expect(b.page.getByRole('log').getByText('Asha')).toBeVisible();

    // Chitra has not opened the chat: the Message tab carries an unread marker until she does.
    await reloadAt(c.page, '/');
    await expect(c.page.getByRole('tab', { name: /Message/ })).toContainText('New messages');
    await c.page.getByRole('tab', { name: 'Message' }).click();
    await expect(c.page.getByText('Who is buying milk?')).toBeVisible();

    // A failed send keeps what was typed.
    await b.page.route('**/rest/v1/chat_messages*', (route) => (route.request().method() === 'POST' ? route.abort('connectionfailed') : route.continue()));
    await b.page.getByLabel('Your message').fill('I will');
    await b.page.getByRole('button', { name: 'Send message' }).click();
    await expect(b.page.getByRole('alert').filter({ hasText: /reach RoomSync/ })).toBeVisible();
    await expect(b.page.getByLabel('Your message')).toHaveValue('I will');
    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('the five tabs go where they say, mark the current one, and the page titles match', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 53');
    const nav = a.page.getByRole('navigation', { name: 'Main' });
    await reloadAt(a.page, '/');
    await expect(nav.getByRole('link')).toHaveText(['Home', 'Shopping', 'Tasks', 'Finance', 'Settings']);
    await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

    for (const [tab, title] of [
      ['Shopping', 'Shopping'],
      ['Tasks', 'Tasks'],
      ['Finance', 'Expenses'],
      ['Settings', 'Settings'],
    ] as const) {
      await nav.getByRole('link', { name: tab }).click();
      await expect(a.page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(nav.getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
      await expect(nav.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    }
    await nav.getByRole('link', { name: 'Home' }).click();
    await expect(a.page.getByRole('heading', { level: 2, name: 'House Feed' })).toBeVisible();

    // Each tab's icon is the design's artwork, painted through a mask in the current or muted colour.
    const icon = nav.getByRole('link', { name: 'Home' }).locator('span[aria-hidden="true"]');
    await expect(icon).toHaveCSS('width', '30px');
    await expect(icon).toHaveCSS('height', '30px');
    const maskImage = await icon.evaluate((el) => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage);
    expect(maskImage).toMatch(/url\(.*\.svg/);
    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('the shell has a single page heading and the logo and wordmark from the design on Home', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 54');
    await reloadAt(a.page, '/');
    await expect(a.page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(a.page.getByRole('heading', { level: 1 })).toHaveText('Flat 54');
    await expect(a.page.getByText('RoomSync', { exact: true })).toBeVisible();
    const logo = a.page.locator('img[src*="logo"]').first();
    await expect(logo).toBeVisible();
    expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await Promise.all([a, b, c].map((u) => u.context.close()));
  });
});
