import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export const PASSWORD = 'e2e-password-1';

let counter = 0;
/** Unique email per call so tests never collide with each other or with earlier runs. */
export function uniqueEmail(label: string): string {
  counter += 1;
  return `${label}-${Date.now()}-${counter}@example.test`;
}

export interface User {
  name: string;
  email: string;
  context: BrowserContext;
  page: Page;
}

/** A fresh browser context (own storage, so a separate "device") with a newly signed-up user. */
export async function newUser(browser: Browser, name: string): Promise<User> {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const page = await context.newPage();
  const email = uniqueEmail(name.toLowerCase());
  await page.goto('/');
  await page.getByRole('link', { name: 'Get started' }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: `Hi, ${name}` })).toBeVisible();
  return { name, email, context, page };
}

/** Creates a household through the UI and returns the invite code shown once on screen. */
export async function createHouseholdWithInvite(page: Page, householdName: string): Promise<string> {
  await page.getByRole('link', { name: /Create a household/ }).click();
  await page.getByLabel('Household name').fill(householdName);
  await page.getByRole('button', { name: 'Create household' }).click();
  await page.getByRole('button', { name: 'Create invite code' }).click();
  const code = (await page.getByTestId('invite-code').innerText()).trim();
  await page.getByRole('button', { name: 'Go to my household' }).click();
  await expect(page.getByRole('heading', { level: 1, name: householdName })).toBeVisible();
  return code;
}

/** Join with a code and confirm; lands on the household home. */
export async function joinAndConfirm(page: Page, code: string, householdName: string): Promise<void> {
  await joinWithCode(page, code);
  await page.getByRole('button', { name: 'Join household' }).click();
  await expect(page.getByRole('heading', { level: 1, name: householdName })).toBeVisible();
}

/** A household with an owner and two more members, each signed in on their own browser context. */
export async function threePersonHousehold(browser: Browser, names: [string, string, string], householdName: string) {
  const a = await newUser(browser, names[0]);
  const b = await newUser(browser, names[1]);
  const c = await newUser(browser, names[2]);
  const code = await createHouseholdWithInvite(a.page, householdName);
  await joinAndConfirm(b.page, code, householdName);
  await joinAndConfirm(c.page, code, householdName);
  return { a, b, c };
}

/** Adds an equal-split expense through the UI (everyone selected). */
export async function addEqualExpense(page: Page, title: string, amount: string): Promise<void> {
  await page.goto('/#/expenses/new');
  await page.getByLabel('What was this for?').fill(title);
  await page.getByLabel(/Total amount/).fill(amount);
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page.getByText('Expense saved.')).toBeVisible();
}

/** Reload first: re-opening the same hash is not a navigation, and live updates arrive in Phase 7. */
export async function youOwe(page: Page): Promise<string> {
  await page.goto('/#/expenses/balances');
  await page.reload();
  await expect(page.getByTestId('you-owe')).toBeVisible();
  return (await page.getByTestId('you-owe').innerText()).trim();
}

export async function youAreOwed(page: Page): Promise<string> {
  await page.goto('/#/expenses/balances');
  await page.reload();
  await expect(page.getByTestId('you-are-owed')).toBeVisible();
  return (await page.getByTestId('you-are-owed').innerText()).trim();
}

export async function joinWithCode(page: Page, code: string): Promise<void> {
  await page.getByRole('link', { name: /Join a household/ }).click();
  await page.getByLabel('Invite code').fill(code);
  await page.getByRole('button', { name: 'Check code' }).click();
}

// ---- Phase 7: activity centre, announcements ----
export const bell = (page: Page, unread?: number) =>
  page.getByRole('button', { name: unread === undefined ? 'Notifications' : `Notifications, ${unread} unread` });

export async function reloadAt(page: Page, hash: string) {
  await page.goto(`/#${hash}`);
  await page.reload();
}

/** Clears the "joined the household" updates so a test can count only what it causes. */
export async function settle(page: Page) {
  await page.goto('/#/activity');
  await page.reload();
  const markAll = page.getByRole('button', { name: 'Mark all as read' });
  // Someone with no updates at all sees the empty state instead of the button.
  await expect(markAll.or(page.getByText('Nothing new'))).toBeVisible();
  if ((await markAll.count()) === 0) return;
  if ((await markAll.getAttribute('aria-disabled')) !== 'true') await markAll.click();
  await expect(markAll).toHaveAttribute('aria-disabled', 'true');
}

export async function post(page: Page, title: string, message: string) {
  await page.goto('/#/house/announcements');
  await page.getByRole('button', { name: 'Post announcement' }).first().click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Message').fill(message);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByText('Announcement posted.')).toBeVisible();
}


/** The local publishable key, to call the database API directly as a signed-in user. */
export function localKeys() {
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
  return { url: env.VITE_SUPABASE_URL as string, key: env.VITE_SUPABASE_PUBLISHABLE_KEY as string };
}

// ---- Phase 8: move-out ----
let cachedAdmin: SupabaseClient | null = null;

/**
 * A service-role client for TEST SETUP ONLY (never the app): it lets a test move a move-out date into the
 * past to simulate time passing. The key comes from the local stack's `supabase status`, not from any file.
 */
export function localAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const out = execSync('npx supabase status -o env', { encoding: 'utf8' });
  const env = Object.fromEntries([...out.matchAll(/^(\w+)="?([^"\r\n]*)"?$/gm)].map((m) => [m[1], m[2]]));
  cachedAdmin = createClient(env.API_URL as string, env.SERVICE_ROLE_KEY as string, { auth: { persistSession: false, autoRefreshToken: false } });
  return cachedAdmin;
}

/** Pretends the member's leaving date arrived (yesterday), by changing the row directly as the stack owner. */
export async function makeMoveOutDue(householdName: string, memberName: string): Promise<void> {
  const admin = localAdmin();
  // Names repeat across test runs on the same local database, so take the newest one.
  const { data: h, error: hErr } = await admin.from('households').select('id').eq('name', householdName).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (hErr || !h) throw new Error(`household not found: ${householdName} ${hErr?.message ?? ''}`);
  const { data: members } = await admin.from('household_members').select('id, user_id, status').eq('household_id', h.id);
  const { data: profiles } = await admin.from('profiles').select('id, display_name').in('id', members!.map((m) => m.user_id));
  const userId = profiles!.find((p) => p.display_name === memberName)!.id;
  const target = members!.find((m) => m.user_id === userId)!;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const { error } = await admin.from('household_members').update({ move_out_effective_date: yesterday }).eq('id', target.id).eq('status', 'leaving');
  if (error) throw error;
}

export const isoDay = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Leaves through the UI: intro, review, date, optional note, explicit confirmation. */
export async function leaveHousehold(page: Page, date: string, note?: string): Promise<void> {
  await page.goto('/#/you/household/leave');
  await page.getByRole('button', { name: /Review what.s outstanding/ }).click();
  await page.getByLabel('Leaving date').fill(date);
  if (note) await page.getByLabel('Note for your housemates').fill(note);
  await page.getByRole('checkbox', { name: 'I understand what happens when I leave.' }).check();
  await page.getByRole('button', { name: 'Leave household' }).click();
}
