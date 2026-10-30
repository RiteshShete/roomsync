import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

// Dates are shown in the viewer's locale, so test expectations like "12 Jun 2026" depended on the machine
// running them (an en-US CI runner prints "Jun 12, 2026"). Pin the default so every machine agrees.
const RealDateTimeFormat = Intl.DateTimeFormat;
Intl.DateTimeFormat = function (locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
  return new RealDateTimeFormat(locales ?? 'en-GB', options);
} as unknown as typeof Intl.DateTimeFormat;
Object.setPrototypeOf(Intl.DateTimeFormat, RealDateTimeFormat);

// Whole-app tests render the full route tree; give async queries room when the machine is busy
// (the suite runs many files in parallel). Slow but correct is not a failure.
configure({ asyncUtilTimeout: 10_000 });

// Unit tests never reach Supabase. The shell shows the bell, reminders and a live channel, and the You tab
// summarises money and chores, so those api modules are replaced for every test file (mockApi() sets empty defaults).
vi.mock('@/api/activity');
vi.mock('@/api/expenses');
vi.mock('@/api/settlements');
vi.mock('@/api/chores');
vi.mock('@/api/groceries');
vi.mock('@/api/announcements');
vi.mock('@/api/realtime', () => ({ subscribeToHousehold: () => () => {} }));
