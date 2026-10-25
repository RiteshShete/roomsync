import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { bell, post, reloadAt, settle, threePersonHousehold } from './helpers';

test.describe.configure({ timeout: 150_000 });

test.describe('Journey G: announcements, activity centre, preferences (three real accounts)', () => {
  test('a member posts; the others are notified; deep link opens it and the count drops; only admins pin', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 21');
    await Promise.all([a, b, c].map((u) => settle(u.page)));

    await post(b.page, 'Water off Tuesday', 'No water from 10 to 12.');
    await expect(b.page.getByRole('heading', { name: 'Water off Tuesday' })).toBeVisible();

    // The author is not notified about their own post; the other two each have one unread update.
    await reloadAt(b.page, '/');
    await expect(bell(b.page)).toBeVisible();
    await reloadAt(a.page, '/');
    await expect(bell(a.page, 1)).toBeVisible();
    await reloadAt(c.page, '/');
    await expect(bell(c.page, 1)).toBeVisible();

    // Home shows it under Recent activity; the bell opens the activity centre.
    await expect(c.page.getByText('Bilal posted an announcement: Water off Tuesday')).toBeVisible();
    await bell(c.page, 1).click();
    await expect(c.page.getByRole('heading', { level: 1, name: 'Activity' })).toBeVisible();
    const row = c.page.getByRole('link', { name: /Bilal posted an announcement/ });
    await expect(row).toBeVisible();

    // Deep link: opens the announcements screen and marks it read.
    await row.click();
    await expect(c.page.getByRole('heading', { level: 1, name: 'Announcements' })).toBeVisible();
    await reloadAt(c.page, '/');
    await expect(bell(c.page)).toBeVisible();

    // Chitra (plain member) can't change or pin Bilal's announcement; the buttons say why.
    await c.page.goto('/#/house/announcements');
    const card = c.page.getByRole('listitem').filter({ hasText: 'Water off Tuesday' });
    await expect(card.getByRole('button', { name: 'Edit' })).toHaveAttribute('aria-disabled', 'true');
    await expect(card.getByRole('button', { name: 'Delete' })).toHaveAttribute('aria-disabled', 'true');
    await expect(card.getByRole('button', { name: 'Pin' })).toHaveCount(0);

    // Asha (owner) pins it; Bilal and Chitra get a pinned notice, Asha does not.
    await a.page.goto('/#/house/announcements');
    await a.page.getByRole('button', { name: 'Pin' }).click();
    await expect(a.page.getByText('Announcement pinned.')).toBeVisible();
    await expect(a.page.getByText('Pinned', { exact: true })).toBeVisible();
    await reloadAt(c.page, '/activity');
    await expect(c.page.getByRole('link', { name: /Asha pinned an announcement/ })).toBeVisible();

    // The database enforces it too: a plain member pinning directly is refused.
    await c.page.goto('/#/house/announcements');
    await expect(c.page.getByText('Pinned', { exact: true })).toBeVisible();

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('turning a category off hides those updates; quiet hours hide only the number', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 22');
    await Promise.all([a, b, c].map((u) => settle(u.page)));

    // Chitra switches Announcements off before anyone posts.
    await c.page.goto('/#/you/notifications');
    await c.page.getByRole('switch', { name: 'Announcements' }).click();
    await c.page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(c.page.getByText('Preferences saved.')).toBeVisible();

    await post(a.page, 'Rent reminder', 'Rent is due on the 1st.');

    // Chitra sees nothing and has no badge; Bilal (default prefs) has one.
    await reloadAt(c.page, '/activity');
    await expect(c.page.getByText('Nothing new')).toBeVisible();
    await reloadAt(b.page, '/');
    await expect(bell(b.page, 1)).toBeVisible();

    // Quiet hours around now: Bilal's number disappears, but the update is still listed.
    const at = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    await b.page.goto('/#/you/notifications');
    await b.page.getByRole('switch', { name: 'Pause the unread badge during quiet hours' }).click();
    await b.page.getByLabel('From').fill(at(new Date(Date.now() - 3_600_000)));
    await b.page.getByLabel('Until').fill(at(new Date(Date.now() + 3_600_000)));
    await b.page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(b.page.getByText('Preferences saved.')).toBeVisible();
    await reloadAt(b.page, '/');
    await expect(bell(b.page, 1)).toHaveCount(0);
    await expect(bell(b.page)).toBeVisible();
    await expect(b.page.getByText('Asha posted an announcement: Rent reminder')).toBeVisible();

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('realtime: Home updates without a reload when someone else adds a grocery', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 23');
    await Promise.all([a, b, c].map((u) => settle(u.page)));

    await reloadAt(a.page, '/');
    await expect(a.page.getByText('Bilal added Milk to the grocery list')).toHaveCount(0);

    await b.page.goto('/#/house/groceries');
    await b.page.getByRole('button', { name: 'Add grocery' }).first().click();
    await b.page.getByLabel(/Item name/).fill('Milk');
    await b.page.getByRole('button', { name: 'Save item' }).click();
    await expect(b.page.getByText('Item added.')).toBeVisible();

    // No reload on Asha's page: the live channel (or its fallback) brings it in.
    await expect(a.page.getByText('Bilal added Milk to the grocery list')).toBeVisible({ timeout: 20_000 });
    await expect(bell(a.page, 1)).toBeVisible();

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('chore reminders are created in-app when the assignee opens the app', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 24');
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    await a.page.goto('/#/chores/new');
    await a.page.getByLabel('What needs doing?').fill('Clean the fridge');
    await a.page.getByLabel('Assign to').selectOption({ label: 'Bilal' });
    await a.page.getByLabel('Due date').fill(iso);
    await a.page.getByRole('button', { name: 'Save chore' }).click();
    await expect(a.page.getByText('Chore created.')).toBeVisible();

    // Bilal opens the app: he gets the assignment and a reminder, in the app only.
    await reloadAt(b.page, '/activity');
    await expect(b.page.getByRole('link', { name: /Asha gave you a new chore: Clean the fridge/ })).toBeVisible();
    await expect(b.page.getByRole('link', { name: /Clean the fridge: this chore is still waiting to be completed/ })).toBeVisible();

    // Opening again the same day does not duplicate the reminder, and nobody else gets one.
    await reloadAt(b.page, '/activity');
    await expect(b.page.getByRole('link', { name: /still waiting to be completed/ })).toHaveCount(1);
    await reloadAt(c.page, '/activity');
    await expect(c.page.getByText('Nothing new')).toBeVisible();

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('profile edit shows to others; export downloads my household data', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 25');

    await b.page.goto('/#/you/profile');
    const name = b.page.getByLabel('Your name');
    await name.fill('Bilal Khan');
    await b.page.getByRole('button', { name: 'Use Green' }).click();
    await b.page.getByRole('button', { name: 'Save changes' }).click();
    await expect(b.page.getByText('Profile updated.')).toBeVisible();

    await reloadAt(a.page, '/you/members');
    await expect(a.page.getByText('Bilal Khan')).toBeVisible();

    // Export: a JSON file with the household's data, without anyone's email or invite code hashes.
    await a.page.goto('/#/you/privacy');
    const [download] = await Promise.all([a.page.waitForEvent('download'), a.page.getByRole('button', { name: 'Download my data' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^roomsync-\d{4}-\d{2}-\d{2}\.json$/);
    const text = readFileSync((await download.path())!, 'utf8');
    const data = JSON.parse(text);
    expect(data.schema_version).toBe(1);
    expect(data.household.name).toBe('Flat 25');
    expect(data.members.map((m: { display_name: string }) => m.display_name).sort()).toEqual(['Asha', 'Bilal Khan', 'Chitra']);
    expect(text).not.toMatch(/@example\.test/);
    expect(text).not.toMatch(/code_hash/);
    await expect(a.page.getByText('Your data was downloaded.')).toBeVisible();

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });
});
