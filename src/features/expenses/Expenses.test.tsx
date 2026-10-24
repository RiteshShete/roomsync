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
});

describe('Expenses tab', () => {
  it('shows what you are owed (and zero owed) as separate figures, never one house balance', async () => {
    renderApp('/expenses');
    expect(await screen.findByTestId('you-are-owed')).toHaveTextContent('₹400.00');
    expect(screen.getByTestId('you-owe')).toHaveTextContent('₹0.00');
    expect(screen.queryByText(/house balance/i)).not.toBeInTheDocument();
  });

  it('shows what you owe when you are the debtor', async () => {
    mockMoney({ balances: [{ memberId: 'm-aarav', netMinor: -25050 }, { memberId: 'm-riya', netMinor: 25050 }] });
    renderApp('/expenses');
    expect(await screen.findByTestId('you-owe')).toHaveTextContent('₹250.50');
    expect(screen.getByTestId('you-are-owed')).toHaveTextContent('₹0.00');
  });

  it('says so when everything is settled', async () => {
    mockMoney({ balances: [{ memberId: 'm-aarav', netMinor: 0 }] });
    renderApp('/expenses');
    expect(await screen.findByText(copy.expenses.allSettled)).toBeInTheDocument();
  });

  it('empty state uses the spec copy and offers Add expense', async () => {
    renderApp('/expenses');
    expect(await screen.findByRole('heading', { name: 'No shared expenses yet' })).toBeInTheDocument();
    expect(screen.getByText('Add a bill or purchase to keep household spending clear.')).toBeInTheDocument();
    const adds = screen.getAllByRole('link', { name: 'Add expense' }); // the empty-state button and the floating +
    expect(adds).toHaveLength(2);
    for (const a of adds) expect(a).toHaveAttribute('href', '/expenses/new');
  });

  it('lists recent expenses with payer, date, total and what it means for you', async () => {
    mockMoney({ expenses: [expense(), expense({ id: 'e2', title: 'Milk', amountMinor: 5000, paidByMemberId: 'm-aarav', shares: [{ memberId: 'm-aarav', shareAmountMinor: 2500, percentBp: null }, { memberId: 'm-riya', shareAmountMinor: 2500, percentBp: null }] })] });
    renderApp('/expenses');
    const bill = (await screen.findByText('Electricity bill')).closest('a')!;
    expect(bill).toHaveAttribute('href', '/expenses/e1');
    expect(within(bill).getByText('₹1,200.00')).toBeInTheDocument();
    expect(within(bill).getByText('Riya')).toBeInTheDocument();
    expect(within(bill).getByText(copy.expenses.yourShare('₹400.00'))).toBeInTheDocument();
    const milk = screen.getByText('Milk').closest('a')!;
    expect(within(milk).getByText(copy.expenses.youPaid, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.expenses.viewAll })).toHaveAttribute('href', '/expenses/all');
  });

  it('tells you when you are not part of an expense', async () => {
    mockMoney({ expenses: [expense({ shares: [{ memberId: 'm-riya', shareAmountMinor: 120000, percentBp: null }] })] });
    renderApp('/expenses');
    expect(await screen.findByText(copy.expenses.notInvolved)).toBeInTheDocument();
  });

  it('has a loading state, then an error with retry for the list', async () => {
    vi.mocked(expensesApi.listExpenses).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/expenses');
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    vi.mocked(expensesApi.listExpenses).mockResolvedValue({ items: [expense()], hasMore: false });
    await userEvent.click(screen.getAllByRole('button', { name: copy.states.retry })[0]!);
    expect(await screen.findByText('Electricity bill')).toBeInTheDocument();
  });

  it('shows a balances error with retry without hiding the list', async () => {
    vi.mocked(expensesApi.getBalances).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mockMoney({ expenses: [expense()] });
    vi.mocked(expensesApi.getBalances).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/expenses');
    expect(await screen.findByText('Electricity bill')).toBeInTheDocument();
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
  });

  it('has Review balances and Record settlement links, and tabs for the three money pages', async () => {
    renderApp('/expenses');
    expect(await screen.findByRole('link', { name: copy.expenses.reviewBalances })).toHaveAttribute('href', '/expenses/balances');
    expect(screen.getByRole('link', { name: copy.expenses.recordSettlement })).toHaveAttribute('href', '/expenses/settle');
    const tabs = screen.getByRole('navigation', { name: copy.expenses.title });
    expect(within(tabs).getAllByRole('link').map((l) => l.textContent)).toEqual(['Expenses', 'Balances', 'Settlements']);
  });

  it('the floating add button links to the form', async () => {
    mockMoney({ expenses: [expense()] });
    renderApp('/expenses');
    await screen.findByText('Electricity bill');
    expect(screen.getByRole('link', { name: copy.expenses.addExpense })).toHaveAttribute('href', '/expenses/new');
  });

  it('archived household: adding and recording are disabled with the reason', async () => {
    mockMoney({ me: membership({ archived: true }) });
    renderApp('/expenses');
    const fab = await screen.findByRole('button', { name: copy.expenses.addExpense });
    expect(fab).toHaveAttribute('aria-disabled', 'true');
    expect(fab).toHaveAccessibleDescription(copy.errors.householdArchived);
    const record = screen.getByRole('button', { name: copy.expenses.recordSettlement });
    expect(record).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(fab);
    expect(screen.getByRole('heading', { level: 1, name: 'Expenses' })).toBeInTheDocument();
  });
});

describe('All expenses', () => {
  it('lists, paginates, and filters (passing every filter to the API)', async () => {
    mockMoney({ expenses: [expense()] });
    renderApp('/expenses/all');
    expect(await screen.findByText('Electricity bill')).toBeInTheDocument();
    expect(expensesApi.listExpenses).toHaveBeenLastCalledWith('h1', {}, 0);

    await userEvent.click(screen.getByRole('button', { name: copy.expenses.filters }));
    const sheet = screen.getByRole('dialog', { name: copy.expenses.filtersTitle });
    await userEvent.type(within(sheet).getByLabelText(copy.expenses.dateFrom), '2026-05-01');
    await userEvent.type(within(sheet).getByLabelText(copy.expenses.dateTo), '2026-05-31');
    await userEvent.selectOptions(within(sheet).getByLabelText(copy.expenses.category), 'utilities');
    await userEvent.selectOptions(within(sheet).getByLabelText(copy.expenses.payer), 'm-riya');
    await userEvent.selectOptions(within(sheet).getByLabelText(copy.expenses.participant), 'm-kunal');
    await userEvent.click(within(sheet).getByRole('switch', { name: copy.expenses.includeDeleted }));
    await userEvent.click(within(sheet).getByRole('button', { name: copy.expenses.apply }));
    await vi.waitFor(() =>
      expect(expensesApi.listExpenses).toHaveBeenLastCalledWith(
        'h1',
        { from: '2026-05-01', to: '2026-05-31', category: 'utilities', payerId: 'm-riya', participantId: 'm-kunal', includeDeleted: true },
        0,
      ),
    );
    expect(screen.getByRole('button', { name: copy.expenses.filtersActive(6) })).toBeInTheDocument();
  });

  it('shows deleted expenses (marked) only when asked', async () => {
    mockMoney({ expenses: [expense({ deletedAt: '2026-05-03T10:00:00Z', deletedBy: 'u-riya' })] });
    renderApp('/expenses/all');
    const card = (await screen.findByText('Electricity bill')).closest('a')!;
    expect(within(card).getByText(copy.expenses.deleted)).toBeInTheDocument();
  });

  it('no matches vs nothing at all are different messages, and filters can be cleared', async () => {
    mockMoney({ expenses: [] });
    renderApp('/expenses/all');
    expect(await screen.findByText(copy.expenses.emptyTitle)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.expenses.filters }));
    await userEvent.selectOptions(screen.getByLabelText(copy.expenses.category), 'rent');
    await userEvent.click(screen.getByRole('button', { name: copy.expenses.apply }));
    expect(await screen.findByText(copy.expenses.noMatchesTitle)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.expenses.clearFilters }));
    expect(await screen.findByText(copy.expenses.emptyTitle)).toBeInTheDocument();
  });

  it('loads more pages on request', async () => {
    mockMoney();
    vi.mocked(expensesApi.listExpenses)
      .mockResolvedValueOnce({ items: [expense({ id: 'a', title: 'First page' })], hasMore: true })
      .mockResolvedValueOnce({ items: [expense({ id: 'b', title: 'Second page' })], hasMore: false });
    renderApp('/expenses/all');
    expect(await screen.findByText('First page')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.expenses.loadMore }));
    expect(await screen.findByText('Second page')).toBeInTheDocument();
    expect(screen.getByText('First page')).toBeInTheDocument();
    expect(expensesApi.listExpenses).toHaveBeenLastCalledWith('h1', {}, 1);
    expect(screen.queryByRole('button', { name: copy.expenses.loadMore })).not.toBeInTheDocument();
  });
});
