import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as expensesApi from '@/api/expenses';
import { copy } from '@/copy';
import { expense, mockMoney } from '@/test/money';
import { membership, renderApp } from '@/test/render';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');
vi.mock('@/api/expenses');
vi.mock('@/api/settlements');

beforeEach(() => {
  vi.resetAllMocks();
  mockMoney();
  vi.mocked(expensesApi.getExpense).mockResolvedValue(expense());
});

const open = async (path = '/expenses/e1') => {
  renderApp(path);
  await screen.findByRole('heading', { name: 'Electricity bill' });
};

describe('expense details', () => {
  it('shows the exact calculation, payer, date, and a total that matches', async () => {
    await open();
    expect(screen.getByText('₹1,200.00', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(copy.expenseDetails.method('Equally'))).toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows.slice(1).map((r) => r.textContent)).toEqual(['Aarav (You)₹400.00', 'Riya₹400.00', 'Kunal₹400.00', 'Total₹1,200.00']);
    expect(screen.getByText('Riya', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('01 May 2026')).toBeInTheDocument();
  });

  it('explains rounding on an uneven equal split', async () => {
    vi.mocked(expensesApi.getExpense).mockResolvedValue(
      expense({ amountMinor: 100000, shares: [{ memberId: 'm-aarav', shareAmountMinor: 33334, percentBp: null }, { memberId: 'm-riya', shareAmountMinor: 33333, percentBp: null }, { memberId: 'm-kunal', shareAmountMinor: 33333, percentBp: null }] }),
    );
    await open();
    expect(screen.getByText(copy.expenseForm.rounding('₹0.01', 'Aarav'))).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row').at(-1)).toHaveTextContent('₹1,000.00');
  });

  it('shows percentages for a percentage split', async () => {
    vi.mocked(expensesApi.getExpense).mockResolvedValue(
      expense({ splitMethod: 'percentage', shares: [{ memberId: 'm-aarav', shareAmountMinor: 90000, percentBp: 7500 }, { memberId: 'm-riya', shareAmountMinor: 30000, percentBp: 2500 }] }),
    );
    await open();
    expect(screen.getByText(copy.expenseDetails.method('By percentage'))).toBeInTheDocument();
    expect(screen.getByText('· 75%')).toBeInTheDocument();
    expect(screen.getByText('· 25%')).toBeInTheDocument();
  });

  it('shows who added and last changed it, and the change history with what changed', async () => {
    vi.mocked(expensesApi.getExpense).mockResolvedValue(expense({ version: 2, updatedBy: 'u-riya' }));
    vi.mocked(expensesApi.listExpenseHistory).mockResolvedValue([
      { id: 'h1', action: 'created', actorMemberId: 'm-riya', createdAt: '2026-05-01T10:00:00Z', before: null, after: { amount_minor: 100000, title: 'Electricity bill' } },
      { id: 'h2', action: 'edited', actorMemberId: 'm-riya', createdAt: '2026-05-02T10:00:00Z', before: { amount_minor: 100000, title: 'Electricity bill', shares: [] }, after: { amount_minor: 120000, title: 'Electricity bill', shares: [] } },
    ]);
    await open();
    expect(await screen.findByText(copy.expenseDetails.changedAmount('₹1,000.00', '₹1,200.00'))).toBeInTheDocument();
    const history = screen.getByRole('list', { name: copy.expenseDetails.history });
    expect(within(history).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByText(/Added by Riya/)).toHaveLength(2); // the summary line and the history entry
    expect(screen.getByText(/Last changed by Riya/)).toBeInTheDocument();
  });

  it('notes appear when present', async () => {
    vi.mocked(expensesApi.getExpense).mockResolvedValue(expense({ notes: 'May bill, paid online' }));
    await open();
    expect(screen.getByText('May bill, paid online')).toBeInTheDocument();
  });

  it('shows the balance impact of an edit, including that settlements were left alone', async () => {
    renderApp({
      pathname: '/expenses/e1',
      state: { edit: { version: 2, settlementsExist: true, impact: [{ memberId: 'm-aarav', beforeMinor: 40000, afterMinor: 30000 }, { memberId: 'm-kunal', beforeMinor: -80000, afterMinor: -60000 }] } },
    });
    expect(await screen.findByRole('heading', { name: copy.expenseDetails.impactTitle })).toBeInTheDocument();
    expect(screen.getByText(copy.expenseDetails.impactLine('Aarav', '₹400.00', '₹300.00'))).toBeInTheDocument();
    expect(screen.getByText(copy.expenseDetails.impactLine('Kunal', '-₹800.00', '-₹600.00'))).toBeInTheDocument();
    expect(screen.getByText(copy.expenseDetails.impactSettlements)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.expenseDetails.dismiss }));
    expect(screen.queryByText(copy.expenseDetails.impactTitle)).not.toBeInTheDocument();
  });

  it('says when no settlements exist yet', async () => {
    renderApp({ pathname: '/expenses/e1', state: { edit: { version: 2, settlementsExist: false, impact: [] } } });
    expect(await screen.findByText(copy.expenseDetails.impactNoSettlements)).toBeInTheDocument();
  });
});

describe('permission-aware actions', () => {
  it('an owner/admin can edit and delete anyone’s expense', async () => {
    await open();
    expect(screen.getByRole('link', { name: copy.expenseDetails.edit })).toHaveAttribute('href', '/expenses/e1/edit');
    expect(screen.getByRole('button', { name: copy.expenseDetails.delete })).not.toHaveAttribute('aria-disabled');
  });

  it('a member can change an expense they added', async () => {
    mockMoney({ me: membership({ role: 'member', memberId: 'm-riya' }) });
    vi.mocked(expensesApi.getExpense).mockResolvedValue(expense({ createdBy: 'u-aarav' })); // session user is u-aarav
    await open();
    expect(screen.getByRole('link', { name: copy.expenseDetails.edit })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.expenseDetails.delete })).not.toHaveAttribute('aria-disabled');
  });

  it('a member cannot change someone else’s expense: disabled, with the reason on screen', async () => {
    mockMoney({ me: membership({ role: 'member' }) });
    await open();
    expect(screen.queryByRole('link', { name: copy.expenseDetails.edit })).not.toBeInTheDocument();
    const edit = screen.getByRole('button', { name: copy.expenseDetails.edit });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    expect(edit).toHaveAccessibleDescription(copy.expenseDetails.noPermission);
    const del = screen.getByRole('button', { name: copy.expenseDetails.delete });
    expect(del).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(del);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByText(copy.expenseDetails.noPermission).length).toBeGreaterThan(0);
  });

  it('archived household: edit and delete are disabled with the reason', async () => {
    mockMoney({ me: membership({ archived: true }) });
    await open();
    expect(screen.getByRole('button', { name: copy.expenseDetails.edit })).toHaveAccessibleDescription(copy.errors.householdArchived);
    expect(screen.getByRole('button', { name: copy.expenseDetails.delete })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('delete and undo', () => {
  it('asks first, explains the effect, deletes with the version, and offers Undo', async () => {
    vi.mocked(expensesApi.getExpense).mockResolvedValue(expense({ version: 4 }));
    vi.mocked(expensesApi.deleteExpense).mockResolvedValue(5);
    vi.mocked(expensesApi.restoreExpense).mockResolvedValue(6);
    await open();
    await userEvent.click(screen.getByRole('button', { name: copy.expenseDetails.delete }));
    const dialog = screen.getByRole('dialog', { name: copy.expenseDetails.deleteTitle });
    expect(dialog).toHaveTextContent('stops counting toward balances');
    expect(expensesApi.deleteExpense).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: copy.expenseDetails.deleteConfirm }));
    expect(expensesApi.deleteExpense).toHaveBeenCalledWith('e1', 4);
    expect(await screen.findByText(copy.expenseDetails.deletedToast)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: copy.expenses.title })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.expenseDetails.undo }));
    expect(expensesApi.restoreExpense).toHaveBeenCalledWith('e1');
    expect(await screen.findByText(copy.expenseDetails.restored)).toBeInTheDocument();
  });

  it('cancelling deletes nothing', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: copy.expenseDetails.delete }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(expensesApi.deleteExpense).not.toHaveBeenCalled();
  });

  it('a failed delete is reported and the expense stays', async () => {
    vi.mocked(expensesApi.deleteExpense).mockRejectedValue({ message: 'conflict' });
    await open();
    await userEvent.click(screen.getByRole('button', { name: copy.expenseDetails.delete }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: copy.expenseDetails.deleteConfirm }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.conflict);
    expect(screen.getByRole('heading', { name: 'Electricity bill' })).toBeInTheDocument();
  });

  it('a deleted expense is marked, says who deleted it, and can be restored', async () => {
    vi.mocked(expensesApi.getExpense).mockResolvedValue(expense({ deletedAt: '2026-05-03T10:00:00Z', deletedBy: 'u-riya' }));
    vi.mocked(expensesApi.restoreExpense).mockResolvedValue(3);
    await open();
    expect(screen.getByText(copy.expenses.deleted)).toBeInTheDocument();
    expect(screen.getByText(/Deleted by Riya/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.expenseDetails.delete })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.expenseDetails.restore }));
    expect(expensesApi.restoreExpense).toHaveBeenCalledWith('e1');
  });

  it('restore is disabled for someone who may not change it', async () => {
    mockMoney({ me: membership({ role: 'member' }) });
    vi.mocked(expensesApi.getExpense).mockResolvedValue(expense({ deletedAt: '2026-05-03T10:00:00Z', deletedBy: 'u-riya' }));
    await open();
    expect(screen.getByRole('button', { name: copy.expenseDetails.restore })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('states', () => {
  it('not found (e.g. another household’s id) is a clear message, not an error screen', async () => {
    vi.mocked(expensesApi.getExpense).mockRejectedValue({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' });
    renderApp('/expenses/zzz');
    expect(await screen.findByText(copy.expenseDetails.notFoundTitle)).toBeInTheDocument();
  });

  it('a network failure offers a retry', async () => {
    vi.mocked(expensesApi.getExpense).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/expenses/e1');
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.states.retry }));
    expect(await screen.findByRole('heading', { name: 'Electricity bill' })).toBeInTheDocument();
  });

  it('shows a loading state first', async () => {
    vi.mocked(expensesApi.getExpense).mockReturnValue(new Promise(() => {}));
    renderApp('/expenses/e1');
    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true');
  });
});
