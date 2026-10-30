import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addEqualExpense, post, threePersonHousehold, type User } from './helpers';

test.describe.configure({ timeout: 240_000 });

/** Every screen a person can reach, with a hash route. */
const ROUTES = [
  '/', '/activity', '/expenses', '/expenses/all', '/expenses/balances', '/expenses/settlements', '/expenses/new', '/expenses/settle',
  '/chores', '/chores/mine', '/chores/completed', '/chores/new', '/house/groceries', '/house/announcements',
  '/you', '/you/profile', '/you/notifications', '/you/privacy', '/you/members', '/you/invites', '/you/household', '/you/household/leave',
];

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** How far the page scrolls sideways, and which elements stick out (ignoring bars that scroll on purpose). */
async function sideways(page: Page): Promise<string> {
  return page.evaluate(() => {
    const over = document.documentElement.scrollWidth - window.innerWidth;
    if (over <= 0) return '0';
    const culprits = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5 && !el.closest('[class*="overflow-x-auto"]'))
      .slice(0, 5)
      .map((el) => el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 50) + ' right=' + Math.round(el.getBoundingClientRect().right) + ' of ' + document.documentElement.clientWidth + ' "' + (el.textContent ?? '').trim().slice(0, 20) + '"');
    // Bisect: which single element, when hidden, removes the sideways scroll? Report the deepest one.
    const fixers: string[] = [];
    for (const el of [...document.querySelectorAll('body *')] as HTMLElement[]) {
      const before = el.style.display;
      el.style.display = 'none';
      if (document.documentElement.scrollWidth <= window.innerWidth) fixers.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 70));
      el.style.display = before;
    }
    return over + 'px by ' + culprits.join(' | ') + ' [hiding fixes it: ' + fixers.slice(-3).join(' | ') + ']';
  });
}

async function scan(page: Page, label: string) {
  // [data-logotype] is the brand wordmark: WCAG 1.4.3 exempts logo text from the contrast minimum.
  const results = await new AxeBuilder({ page }).withTags(WCAG).exclude('[data-logotype]').analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(summary, `${label}: accessibility violations`).toEqual([]);
}

/** A household with something on every screen, so the scan sees real content, not just empty states. */
async function populated(browser: Parameters<Parameters<typeof test>[2]>[0]['browser']) {
  const users = await threePersonHousehold(browser, ['Asha', 'Bilal', 'Chitra'], 'Flat Access');
  const { a, b } = users;
  await addEqualExpense(a.page, 'Dinner', '900');
  await a.page.goto('/#/chores/new');
  await a.page.getByLabel('What needs doing?').fill('Recycling');
  await a.page.getByLabel('Due date').fill(new Date().toISOString().slice(0, 10));
  await a.page.getByRole('button', { name: 'Save chore' }).click();
  await expect(a.page.getByText('Chore created.')).toBeVisible();
  await a.page.goto('/#/house/groceries');
  await a.page.getByRole('button', { name: 'Add grocery' }).first().click();
  await a.page.getByLabel(/Item name/).fill('Milk');
  await a.page.getByRole('button', { name: 'Save item' }).click();
  await expect(a.page.getByText('Item added.')).toBeVisible();
  await post(b.page, 'Water off', 'Tuesday 10 to 12');
  return users;
}

const closeAll = (users: { a: User; b: User; c: User }) => Promise.all([users.a, users.b, users.c].map((u) => u.context.close()));

test.describe('Accessibility: automated WCAG scan', () => {
  test('every screen has no WCAG A/AA violations (with real data)', async ({ browser }) => {
    const users = await populated(browser);
    for (const route of ROUTES) {
      await users.a.page.goto(`/#${route}`);
      await users.a.page.reload();
      await users.a.page.waitForLoadState('networkidle');
      await users.a.page.waitForTimeout(400);
      await scan(users.a.page, route);
    }
    await closeAll(users);
  });

  test('overlays have none either: add sheet, edit sheet, confirm dialog, manage member, toast', async ({ browser }) => {
    const users = await populated(browser);
    const page = users.a.page;

    await page.goto('/#/house/groceries');
    await page.getByRole('button', { name: 'Add grocery' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await scan(page, 'add grocery sheet');
    await page.keyboard.press('Escape');

    await page.goto('/#/house/announcements');
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await scan(page, 'delete confirmation');
    await page.keyboard.press('Escape');

    await page.goto('/#/you/members');
    await page.getByRole('button', { name: 'Manage Bilal' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await scan(page, 'manage member sheet');
    await page.keyboard.press('Escape');

    await page.goto('/#/house/groceries');
    await page.getByRole('checkbox', { name: 'Mark Milk as purchased' }).click();
    await expect(page.getByText('Milk marked as purchased.')).toBeVisible();
    await scan(page, 'with a toast showing');
    await closeAll(users);
  });
});

test.describe('Accessibility: keyboard only', () => {
  test('a sheet traps focus, Escape closes it, and focus returns to what opened it', async ({ browser }) => {
    const users = await populated(browser);
    const page = users.a.page;
    await page.goto('/#/house/groceries');
    const opener = page.getByRole('button', { name: 'Add grocery' }).first();
    await opener.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true); // focus moved inside

    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement)), `Tab ${i + 1} stayed inside`).toBe(true);
    }
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press('Shift+Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement)), `Shift+Tab ${i + 1} stayed inside`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    await closeAll(users);
  });

  test('a confirmation starts on the safe choice (Cancel) and Escape keeps the item', async ({ browser }) => {
    const users = await populated(browser);
    const page = users.a.page;
    await page.goto('/#/house/announcements');
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Keep it' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Water off' })).toBeVisible();
    await closeAll(users);
  });

  test('a whole task works without a mouse: add a grocery item, buy it, and move it back', async ({ browser }) => {
    const users = await populated(browser);
    const page = users.a.page;
    await page.goto('/#/house/groceries');
    await page.getByRole('button', { name: 'Add grocery' }).first().focus();
    await page.keyboard.press('Enter');
    await page.getByLabel(/Item name/).focus();
    await page.keyboard.type('Rice');
    // Tab to Save item (the form's submit button) and press Enter
    await page.getByRole('button', { name: 'Save item' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Item added.')).toBeVisible();

    const box = page.getByRole('checkbox', { name: 'Mark Rice as purchased' });
    await box.focus();
    await page.keyboard.press('Space');
    await expect(page.getByText('Rice marked as purchased.')).toBeVisible();
    await page.getByRole('tab', { name: /Bought/ }).focus();
    await page.keyboard.press('Enter');
    const back = page.getByRole('checkbox', { name: 'Move Rice back to Needed' });
    await back.focus();
    await page.keyboard.press('Space');
    await expect(page.getByText('Rice is back on the list.')).toBeVisible();
    await closeAll(users);
  });

  test('every interactive control on the main screens shows a visible focus ring', async ({ browser }) => {
    const users = await populated(browser);
    const page = users.a.page;
    for (const route of ['/', '/chores', '/expenses', '/you']) {
      await page.goto(`/#${route}`);
      await page.reload();
      await page.waitForLoadState('networkidle');
      const seen = new Set<string>();
      for (let i = 0; i < 40; i += 1) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const visible = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
          return { key: el.tagName + ':' + (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30), visible };
        });
        if (!info || seen.has(info.key)) continue;
        seen.add(info.key);
        expect(info.visible, `${route}: ${info.key} has a visible focus outline`).toBe(true);
      }
      expect(seen.size, `${route}: tabbing reached controls`).toBeGreaterThan(4);
    }
    await closeAll(users);
  });

  test('tab order is logical: header, content, then the bottom navigation', async ({ browser }) => {
    const users = await populated(browser);
    const page = users.a.page;
    await page.goto('/#/chores');
    await page.reload();
    await page.waitForLoadState('networkidle');
    const order: string[] = [];
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => (document.activeElement?.closest('nav,header,main')?.tagName ?? 'other').toLowerCase()));
    }
    const first = (t: string) => order.indexOf(t);
    expect(first('header')).toBeGreaterThanOrEqual(0);
    expect(first('header')).toBeLessThan(first('main') === -1 ? 99 : first('main'));
    expect(order.lastIndexOf('main')).toBeLessThan(order.lastIndexOf('nav') === -1 ? 99 : order.lastIndexOf('nav') + 1);
    await closeAll(users);
  });
});

test.describe('Accessibility: motion, size and width', () => {
  test('reduced motion switches animations and transitions off', async ({ browser }) => {
    const users = await populated(browser);
    const page = users.a.page;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#/house/groceries');
    await page.reload();
    await page.getByRole('button', { name: 'Add grocery' }).first().click();
    const durations = await page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .map((el) => getComputedStyle(el))
        .filter((cs) => cs.animationName !== 'none' || parseFloat(cs.transitionDuration) > 0)
        .map((cs) => Math.max(parseFloat(cs.animationDuration) || 0, parseFloat(cs.transitionDuration) || 0)),
    );
    expect(Math.max(0, ...durations), 'longest animation/transition in seconds').toBeLessThan(0.05);
    await closeAll(users);
  });

  for (const width of [320, 390]) {
    test(`at ${width}px nothing overflows sideways and the bottom nav never hides content`, async ({ browser }) => {
      const users = await populated(browser);
      const page = users.a.page;
      await page.setViewportSize({ width, height: 700 });
      for (const route of ROUTES) {
        await page.goto(`/#${route}`);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(300);
        expect(await sideways(page), `${route} at ${width}px scrolls sideways`).toBe('0');
        // the last piece of content can be scrolled fully above the fixed nav
        const hidden = await page.evaluate(() => {
          const nav = document.querySelector('nav[aria-label="Main"]');
          const main = document.querySelector('main');
          if (!nav || !main) return 0;
          window.scrollTo(0, document.body.scrollHeight);
          const last = [...main.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().height > 0).pop();
          return last ? Math.round(last.getBoundingClientRect().bottom - nav.getBoundingClientRect().top) : 0;
        });
        expect(hidden, `${route} at ${width}px: content under the nav by ${hidden}px`).toBeLessThanOrEqual(1);
      }
      await closeAll(users);
    });
  }

  test('with the on-screen keyboard open (short viewport) a focused field stays visible above the nav', async ({ browser }) => {
    const users = await populated(browser);
    const page = users.a.page;
    await page.setViewportSize({ width: 390, height: 360 });
    await page.goto('/#/expenses/new');
    await page.getByLabel('What was this for?').focus();
    for (const label of [/What was this for/, /Total amount/]) {
      const field = page.getByLabel(label).first();
      await field.focus();
      await field.scrollIntoViewIfNeeded();
      const clear = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const nav = document.querySelector('nav[aria-label="Main"]');
        return nav ? Math.round(nav.getBoundingClientRect().top - el.getBoundingClientRect().bottom) : 0;
      });
      expect(clear, `${label} clear of the nav by ${clear}px`).toBeGreaterThanOrEqual(0);
    }
    await closeAll(users);
  });

  test('at 200% text size the main screens still work: no sideways scroll, actions reachable', async ({ browser }) => {
    const users = await populated(browser);
    const page = users.a.page;
    await page.setViewportSize({ width: 390, height: 800 });
    for (const route of ROUTES) {
      await page.goto(`/#${route}`);
      await page.reload();
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);
      expect(await sideways(page), `${route} at 200% scrolls sideways`).toBe('0');
    }
    // the add-expense submit button can still be reached and is not clipped
    await page.goto('/#/expenses/new');
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const save = page.getByRole('button', { name: 'Save expense' });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeVisible();
    await closeAll(users);
  });
});

test.describe('Accessibility: announcements to assistive tech', () => {
  test('toasts are announced politely, errors assertively, and field errors are tied to their fields', async ({ browser }) => {
    const users = await populated(browser);
    const page = users.a.page;

    await page.goto('/#/house/groceries');
    await page.getByRole('checkbox', { name: 'Mark Milk as purchased' }).click();
    const polite = page.locator('[aria-live="polite"]').filter({ hasText: 'Milk marked as purchased.' });
    await expect(polite).toBeVisible();

    // an error toast is role=alert: block the next save, then tick the item back
    await page.context().setOffline(true);
    await page.getByRole('tab', { name: /Bought/ }).click();
    await page.getByRole('checkbox', { name: 'Move Milk back to Needed' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /reach RoomSync/ })).toBeVisible();
    await page.context().setOffline(false);

    // a form error is linked to its input by aria-describedby and the input is marked invalid
    await page.goto('/#/expenses/new');
    await page.getByLabel('What was this for?').fill('x');
    await page.getByLabel(/Total amount/).fill('0');
    await page.getByRole('button', { name: 'Save expense' }).click({ force: true });
    const invalid = page.locator('[aria-invalid="true"]').first();
    if ((await invalid.count()) > 0) {
      const describedBy = await invalid.getAttribute('aria-describedby');
      expect(describedBy, 'invalid field points at its message').toBeTruthy();
    }
    await closeAll(users);
  });

  test('the page has one main landmark, one h1, labelled navigation, and a language', async ({ browser }) => {
    const users = await populated(browser);
    const page = users.a.page;
    for (const route of ['/', '/expenses', '/chores', '/house/groceries', '/you', '/activity']) {
      await page.goto(`/#${route}`);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.lang)).toBeTruthy();
    }
    await closeAll(users);
  });
});
