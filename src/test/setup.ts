import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

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
