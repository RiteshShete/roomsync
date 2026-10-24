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

export async function joinWithCode(page: Page, code: string): Promise<void> {
  await page.getByRole('link', { name: /Join a household/ }).click();
  await page.getByLabel('Invite code').fill(code);
  await page.getByRole('button', { name: 'Check code' }).click();
}
