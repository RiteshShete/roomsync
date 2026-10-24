import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as choresApi from '@/api/chores';
import { copy } from '@/copy';
import { chore, inDays, mockHome } from '@/test/home';
import { kunal, member, membership, renderApp, riya, aarav } from '@/test/render';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');
vi.mock('@/api/chores');
vi.mock('@/api/groceries');

beforeEach(() => {
  vi.resetAllMocks();
  mockHome();
});

const card = (title: string) => screen.getByText(title, { selector: 'p' }).closest('li')!;

describe('chore lists', () => {
  const open = [
    chore({ id: 'a', title: 'Due today', dueDate: inDays(0) }),
    chore({ id: 'b', title: 'Overdue chore', dueDate: inDays(-2), assigneeMemberId: 'm-kunal' }),
    chore({ id: 'c', title: 'Tomorrow chore', dueDate: inDays(1) }),
    chore({ id: 'd', title: 'No date chore', dueDate: null }),
    chore({ id: 'e', title: 'Far chore', dueDate: inDays(10) }),
  ];

  it('Today holds due-today and overdue chores; Upcoming holds the rest; tab counts match', async () => {
    mockHome({ open });
    renderApp('/chores');
    expect(await screen.findByText('Due today', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Overdue chore', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByText('Tomorrow chore', { selector: 'p' })).not.toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: copy.chores.title });
    expect(within(tabs).getAllByRole('link').map((l) => l.textContent)).toEqual(['Today (2)', 'Upcoming (3)', 'Completed (0)']);
    await userEvent.click(within(tabs).getByRole('link', { name: /Upcoming/ }));
    expect(await screen.findByText('Tomorrow chore', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('No date chore', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Far chore', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByText('Due today', { selector: 'p' })).not.toBeInTheDocument();
  });

  it('a chore due soon says how long is left; tomorrow and today are plain words', async () => {
    mockHome({ open: [chore({ id: 'x', title: 'Soon', dueDate: inDays(3) }), chore({ id: 'y', title: 'Tom', dueDate: inDays(1) })] });
    renderApp('/chores/upcoming');
    expect(within(await screen.findByText('Soon', { selector: 'p' }).then((e) => e.closest('li')!)).getByText('3 days')).toBeInTheDocument();
    expect(within(card('Tom')).getByText(copy.chores.due.tomorrow)).toBeInTheDocument();
  });

  it('overdue is shown neutrally: a calm sentence, the original date, and no alarm colour', async () => {
    mockHome({ open });
    renderApp('/chores');
    const li = (await screen.findByText('Overdue chore', { selector: 'p' })).closest('li')!;
    expect(within(li).getByText(copy.chores.waiting)).toBeInTheDocument();
    expect(within(li).getByText(/Was due/)).toBeInTheDocument();
    expect(li.innerHTML).not.toMatch(/text-danger|bg-danger|border-danger/);
    // and there is no ranking or scoring anywhere
    expect(document.body.textContent).not.toMatch(/leaderboard|points|rank|score/i);
  });

  it('shows the assignee, a repeat chip, and a "moving out" chip', async () => {
    mockHome({
      open: [chore({ id: 'r', title: 'Trash', assigneeMemberId: 'm-kunal', recurrenceFrequency: 'weekly' }), chore({ id: 'u', title: 'Anyone', assigneeMemberId: null })],
      members: [aarav, riya, member({ memberId: 'm-kunal', userId: 'u-kunal', role: 'member', status: 'leaving', displayName: 'Kunal' })],
    });
    renderApp('/chores');
    const li = (await screen.findByText('Trash', { selector: 'p' })).closest('li')!;
    expect(within(li).getByText('Kunal')).toBeInTheDocument();
    expect(within(li).getByText(copy.chores.repeats.weekly!)).toBeInTheDocument();
    expect(within(li).getByText(copy.chores.movingOut)).toBeInTheDocument();
    expect(within(card('Anyone')).getByText(copy.chores.unassigned)).toBeInTheDocument();
  });

  it('empty states: nothing at all uses the spec copy with a way to add; empty tabs explain themselves', async () => {
    renderApp('/chores');
    expect(await screen.findByText('No chores assigned yet')).toBeInTheDocument();
    expect(screen.getByText('Add a task to get started.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: copy.chores.create }).every((l) => l.getAttribute('href') === '/chores/new')).toBe(true);
  });

  it('empty Today when other chores exist', async () => {
    mockHome({ open: [chore({ dueDate: inDays(5) })] });
    renderApp('/chores');
    expect(await screen.findByText(copy.chores.emptyToday)).toBeInTheDocument();
  });

  it('Completed is a history with who finished it, and each can be reopened', async () => {
    mockHome({ completed: [chore({ id: 'k', title: 'Old job', status: 'completed', completedAt: '2026-05-03T10:00:00Z', completedBy: 'u-riya' })] });
    vi.mocked(choresApi.reopenChore).mockResolvedValue();
    renderApp('/chores/completed');
    const li = (await screen.findByText('Old job', { selector: 'p' })).closest('li')!;
    expect(within(li).getByText(/Completed by Riya/)).toBeInTheDocument();
    await userEvent.click(within(li).getByRole('button', { name: copy.chores.undo }));
    expect(choresApi.reopenChore).toHaveBeenCalledWith('k');
    expect(await screen.findByText(copy.chores.reopened)).toBeInTheDocument();
  });

  it('loading, then an error with retry', async () => {
    vi.mocked(choresApi.listChores).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/chores');
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    vi.mocked(choresApi.listChores).mockResolvedValue({ open: [chore({ title: 'Back again' })], completed: [] });
    await userEvent.click(screen.getByRole('button', { name: copy.states.retry }));
    expect(await screen.findByText('Back again', { selector: 'p' })).toBeInTheDocument();
  });
});

describe('marking a chore done', () => {
  beforeEach(() => mockHome({ open: [chore({ id: 'a', title: 'Dishes', version: 3, recurrenceFrequency: 'weekly', rotationMemberIds: ['m-riya', 'm-kunal'] })] }));

  it('completes with its version and says "Nice work — task completed."', async () => {
    vi.mocked(choresApi.completeChore).mockResolvedValue({ nextChoreId: null, nextAssigneeMemberId: null, skippedMemberIds: [] });
    renderApp('/chores');
    await userEvent.click(await screen.findByRole('button', { name: copy.chores.markDone }));
    expect(choresApi.completeChore).toHaveBeenCalledWith('a', 3);
    expect(await screen.findByText(copy.chores.done)).toBeInTheDocument();
  });

  it('names who is next when the chore repeats with rotation', async () => {
    vi.mocked(choresApi.completeChore).mockResolvedValue({ nextChoreId: 'n', nextAssigneeMemberId: 'm-kunal', skippedMemberIds: [] });
    renderApp('/chores');
    await userEvent.click(await screen.findByRole('button', { name: copy.chores.markDone }));
    expect(await screen.findByText(`${copy.chores.done} ${copy.chores.nextUp('Kunal')}`)).toBeInTheDocument();
  });

  it('explains when rotation skipped someone who is not active', async () => {
    vi.mocked(choresApi.completeChore).mockResolvedValue({ nextChoreId: 'n', nextAssigneeMemberId: 'm-aarav', skippedMemberIds: ['m-kunal'] });
    renderApp('/chores');
    await userEvent.click(await screen.findByRole('button', { name: copy.chores.markDone }));
    expect(await screen.findByText(new RegExp(copy.chores.skipped('Kunal')))).toBeInTheDocument();
  });

  it('says when the next occurrence has nobody to go to', async () => {
    vi.mocked(choresApi.completeChore).mockResolvedValue({ nextChoreId: 'n', nextAssigneeMemberId: null, skippedMemberIds: [] });
    renderApp('/chores');
    await userEvent.click(await screen.findByRole('button', { name: copy.chores.markDone }));
    expect(await screen.findByText(new RegExp(copy.chores.unassignedNext))).toBeInTheDocument();
  });

  it('Undo reopens it (accidental completion)', async () => {
    vi.mocked(choresApi.completeChore).mockResolvedValue({ nextChoreId: null, nextAssigneeMemberId: null, skippedMemberIds: [] });
    vi.mocked(choresApi.reopenChore).mockResolvedValue();
    renderApp('/chores');
    await userEvent.click(await screen.findByRole('button', { name: copy.chores.markDone }));
    await userEvent.click(await screen.findByRole('button', { name: copy.chores.undo }));
    expect(choresApi.reopenChore).toHaveBeenCalledWith('a');
    expect(await screen.findByText(copy.chores.reopened)).toBeInTheDocument();
  });

  it('a later occurrence already done blocks the undo with a clear message', async () => {
    vi.mocked(choresApi.completeChore).mockResolvedValue({ nextChoreId: null, nextAssigneeMemberId: null, skippedMemberIds: [] });
    vi.mocked(choresApi.reopenChore).mockRejectedValue({ message: 'later_occurrence_completed' });
    renderApp('/chores');
    await userEvent.click(await screen.findByRole('button', { name: copy.chores.markDone }));
    await userEvent.click(await screen.findByRole('button', { name: copy.chores.undo }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.laterOccurrenceCompleted);
  });

  it('a conflict (someone else just changed it) refreshes the list and says so', async () => {
    vi.mocked(choresApi.completeChore).mockRejectedValue({ message: 'conflict' });
    renderApp('/chores');
    await userEvent.click(await screen.findByRole('button', { name: copy.chores.markDone }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.chores.conflictDone);
    await vi.waitFor(() => expect(vi.mocked(choresApi.listChores).mock.calls.length).toBeGreaterThan(1));
  });

  it('shows a busy button and does not double-submit', async () => {
    let resolve!: (v: choresApi.CompleteResult) => void;
    vi.mocked(choresApi.completeChore).mockReturnValue(new Promise((r) => (resolve = r)));
    renderApp('/chores');
    await userEvent.click(await screen.findByRole('button', { name: copy.chores.markDone }));
    const busy = await screen.findByRole('button', { name: copy.chores.marking });
    await userEvent.click(busy);
    expect(choresApi.completeChore).toHaveBeenCalledTimes(1);
    resolve({ nextChoreId: null, nextAssigneeMemberId: null, skippedMemberIds: [] });
  });
});

describe('who can do what (UX; the database enforces it)', () => {
  it('a plain member cannot complete or edit someone else’s assigned chore: disabled with the reason', async () => {
    mockHome({ me: membership({ role: 'member' }), open: [chore({ title: 'Theirs', assigneeMemberId: 'm-riya', createdBy: 'u-riya' })] });
    renderApp('/chores');
    const li = (await screen.findByText('Theirs', { selector: 'p' })).closest('li')!;
    const done = within(li).getByRole('button', { name: copy.chores.markDone });
    expect(done).toHaveAttribute('aria-disabled', 'true');
    expect(done).toHaveAccessibleDescription(copy.chores.noPermissionDone);
    expect(within(li).getByRole('button', { name: copy.chores.edit })).toHaveAccessibleDescription(copy.chores.noPermissionEdit);
    await userEvent.click(done);
    expect(choresApi.completeChore).not.toHaveBeenCalled();
  });

  it('any member may complete an unassigned chore, but not edit it', async () => {
    mockHome({ me: membership({ role: 'member' }), open: [chore({ title: 'Free', assigneeMemberId: null, createdBy: 'u-riya' })] });
    renderApp('/chores');
    const li = (await screen.findByText('Free', { selector: 'p' })).closest('li')!;
    expect(within(li).getByRole('button', { name: copy.chores.markDone })).not.toHaveAttribute('aria-disabled');
    expect(within(li).getByRole('button', { name: copy.chores.edit })).toHaveAttribute('aria-disabled', 'true');
  });

  it('the assignee can complete and edit', async () => {
    mockHome({ me: membership({ role: 'member' }), open: [chore({ title: 'Mine', assigneeMemberId: 'm-aarav' })] });
    renderApp('/chores');
    const li = (await screen.findByText('Mine', { selector: 'p' })).closest('li')!;
    expect(within(li).getByRole('link', { name: copy.chores.edit })).toHaveAttribute('href', '/chores/c1/edit');
    expect(within(li).getByRole('button', { name: copy.chores.markDone })).not.toHaveAttribute('aria-disabled');
  });

  it('archived household: everything is disabled with the reason', async () => {
    mockHome({ me: membership({ archived: true }), open: [chore({ title: 'Frozen', assigneeMemberId: 'm-aarav' })] });
    renderApp('/chores');
    const li = (await screen.findByText('Frozen', { selector: 'p' })).closest('li')!;
    expect(within(li).getByRole('button', { name: copy.chores.markDone })).toHaveAccessibleDescription(copy.errors.householdArchived);
    expect(within(li).getByRole('button', { name: copy.chores.edit })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: copy.chores.create })).toHaveAttribute('aria-disabled', 'true');
  });
});

it('keeps shared fixtures honest', () => {
  expect([riya.role, kunal.role]).toEqual(['admin', 'member']);
});
