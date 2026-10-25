import { expect, test } from '@playwright/test';
import { bell, post, reloadAt, settle, threePersonHousehold } from './helpers';

test.describe.configure({ timeout: 150_000 });

test.describe('Edge cases: announcements, activity, reminders (three real accounts)', () => {
  test('two people edit the same announcement: the second is told, nothing is lost, and the list refreshes', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 31');
    await post(a.page, 'House rules', 'Quiet after 10pm.');

    // Asha (owner) edits the announcement.
    await reloadAt(a.page, '/house/announcements');
    await reloadAt(c.page, '/house/announcements');
    await expect(c.page.getByRole('heading', { name: 'House rules' })).toBeVisible();

    await a.page.getByRole('button', { name: 'Edit' }).click();
    await a.page.getByLabel('Title').fill('House rules v2');
    await a.page.getByRole('button', { name: 'Save changes' }).click();
    await expect(a.page.getByText('Announcement updated.')).toBeVisible();

    // A plain member sees no Pin button at all.
    await reloadAt(b.page, '/house/announcements');
    await expect(b.page.getByRole('button', { name: 'Pin' })).toHaveCount(0);

    // Asha keeps a stale copy open in a second tab; her own later edit makes that copy out of date.
    const stale = await a.context.newPage();
    await stale.goto('/#/house/announcements');
    await expect(stale.getByRole('heading', { name: 'House rules v2' })).toBeVisible();
    await a.page.getByRole('button', { name: 'Edit' }).click();
    await a.page.getByLabel('Title').fill('House rules v3');
    await a.page.getByRole('button', { name: 'Save changes' }).click();
    await expect(a.page.getByText('Announcement updated.')).toBeVisible();

    await stale.getByRole('button', { name: 'Edit' }).click();
    await stale.getByLabel('Title').fill('Stale write');
    await stale.getByRole('button', { name: 'Save changes' }).click();
    await expect(stale.getByText('Someone just changed this announcement. We refreshed the list.')).toBeVisible();
    await expect(stale.getByRole('heading', { name: 'House rules v3' })).toBeVisible();
    await expect(stale.getByRole('heading', { name: 'Stale write' })).toHaveCount(0);

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('posting while offline fails visibly and keeps everything typed; retrying works', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 32');
    await a.page.goto('/#/house/announcements');
    await a.page.getByRole('button', { name: 'Post announcement' }).first().click();
    await a.page.getByLabel('Title').fill('Offline draft');
    await a.page.getByLabel('Message').fill('Typed with no connection.');

    await a.context.setOffline(true);
    await a.page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(a.page.getByRole('alert').filter({ hasText: /connect|network|offline/i }).first()).toBeVisible();
    await expect(a.page.getByLabel('Title')).toHaveValue('Offline draft');
    await expect(a.page.getByLabel('Message')).toHaveValue('Typed with no connection.');

    await a.context.setOffline(false);
    await a.page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(a.page.getByText('Announcement posted.')).toBeVisible();
    await expect(a.page.getByRole('heading', { name: 'Offline draft' })).toBeVisible();

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('markup in an announcement is shown as text for everyone and nothing runs', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 33');
    await post(a.page, '<img src=x onerror="window.__pwned=1">', '<script>window.__pwned=1</script> & "quotes"');
    await settle(b.page);
    await reloadAt(b.page, '/house/announcements');
    await expect(b.page.getByRole('heading', { name: '<img src=x onerror="window.__pwned=1">' })).toBeVisible();
    await expect(b.page.getByText('<script>window.__pwned=1</script> & "quotes"')).toBeVisible();
    expect(await b.page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    // and the activity line shows the title as text too
    await reloadAt(b.page, '/activity');
    await expect(b.page.getByText('Asha posted an announcement: <img src=x onerror="window.__pwned=1">')).toBeVisible();

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('marking everything read leaves the bell without a number, and new updates count again from zero', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 35');
    await settle(a.page);
    await reloadAt(a.page, '/');
    await expect(bell(a.page)).toBeVisible();

    await post(b.page, 'One', 'First.');
    await post(b.page, 'Two', 'Second.');
    await reloadAt(a.page, '/');
    await expect(bell(a.page, 2)).toBeVisible();
    await settle(a.page);
    await reloadAt(a.page, '/');
    await expect(bell(a.page)).toBeVisible();

    await post(b.page, 'Three', 'Third.');
    await reloadAt(a.page, '/');
    await expect(bell(a.page, 1)).toBeVisible();

    await Promise.all([a, b, c].map((u) => u.context.close()));
  });

  test('reminders: a chore that is not due, or is done, never produces one', async ({ browser }) => {
    const { a, b, c } = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat 36');
    const day = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const addChore = async (title: string, due: string) => {
      await a.page.goto('/#/chores/new');
      await a.page.getByLabel('What needs doing?').fill(title);
      await a.page.getByLabel('Assign to').selectOption({ label: 'Bilal' });
      await a.page.getByLabel('Due date').fill(due);
      await a.page.getByRole('button', { name: 'Save chore' }).click();
      await expect(a.page.getByText('Chore created.')).toBeVisible();
    };
    await addChore('Future chore', day(5));
    await addChore('Done chore', day(0));

    // Bilal opens the app (his reminders are created), then completes "Done chore" as its assignee.
    await reloadAt(b.page, '/chores');
    const row = b.page.getByRole('listitem').filter({ hasText: 'Done chore' });
    await row.getByRole('button', { name: 'Mark as done' }).click();
    await expect(b.page.getByText('Nice work — task completed.')).toBeVisible();

    // The future chore only has its "gave you a chore" notice; the due one got exactly one reminder when Bilal first opened the app.
    await reloadAt(b.page, '/activity');
    await expect(b.page.getByRole('link', { name: /Future chore: this chore is still waiting/ })).toHaveCount(0);
    await expect(b.page.getByRole('link', { name: /gave you a new chore: Future chore/ })).toBeVisible();
    await expect(b.page.getByRole('link', { name: /Done chore: this chore is still waiting/ })).toHaveCount(1);
    await Promise.all([a, b, c].map((u) => u.context.close()));
  });
});
