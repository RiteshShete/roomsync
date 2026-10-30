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
  it('splits what I owe from what I am owed, with padded counts, and never shows one house balance', async () => {
    mockMoney({ expenses: [expense(), expense({ id: 'e2', title: 'Milk', amountMinor: 5000, paidByMemberId: 'm-aarav', shares: [{ memberId: 'm-aarav', shareAmountMinor: 2500, percentBp: null }, { memberId: 'm-riya', shareAmountMinor: 2500, percentBp: null }] })] });
    renderApp('/expenses');
    expect(await screen.findByRole('link', { name: /^To Pay\s+\(01\)$/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^To Receive\s+\(01\)$/ })).toBeInTheDocument();
    expect(await screen.findByText('Electricity bill')).toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();
    expect(screen.queryByText(/house balance/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /To Receive/ }));
    expect(await screen.findByText('Milk')).toBeInTheDocument();
    expect(screen.queryByText('Electricity bill')).not.toBeInTheDocument();
  });

  it('empty state uses the spec copy and offers Add expense', async () => {
    renderApp('/expenses');
    expect(await screen.findByRole('heading', { name: 'No shared expenses yet' })).toBeInTheDocument();
    expect(screen.getByText('Add a bill or purchase to keep household spending clear.')).toBeInTheDocument();
    const adds = screen.getAllByRole('link', { name: 'Add expense' }); // the empty-state button and the floating +
    expect(adds).toHaveLength(2);
    for (const a of adds) expect(a).toHaveAttribute('href', '/expenses/new');
  });

  it('an empty tab says what would show up there', async () => {
    mockMoney({ expenses: [expense()] });
    renderApp('/expenses/receive');
    expect(await screen.findByText(copy.expenses.emptyReceive)).toBeInTheDocument();
    expect(screen.getByText(copy.expenses.emptyReceiveBody)).toBeInTheDocument();
  });

  it('lists expenses with payer, date, total and what it means for you', async () => {
    mockMoney({ expenses: [expense(), expense({ id: 'e2', title: 'Milk', amountMinor: 5000, paidByMemberId: 'm-aarav', shares: [{ memberId: 'm-aarav', shareAmountMinor: 2500, percentBp: null }, { memberId: 'm-riya', shareAmountMinor: 2500, percentBp: null }] })] });
    renderApp('/expenses');
    const bill = (await screen.findByText('Electricity bill')).closest('a')!;
    expect(bill).toHaveAttribute('href', '/expenses/e1');
    expect(within(bill).getByText('₹1,200.00')).toBeInTheDocument();
    expect(within(bill).getByText(copy.expenseDetails.totalLine)).toBeInTheDocument();
    expect(within(bill).getByText('Riya')).toBeInTheDocument();
    expect(within(bill).getByText(copy.expenses.yourShare('₹400.00'))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /To Receive/ }));
    const milk = (await screen.findByText('Milk')).closest('a')!;
    expect(within(milk).getByText(copy.expenses.youPaid, { exact: false })).toBeInTheDocument();
  });

  it('keeps balances, settlements and the full list one tap away', async () => {
    mockMoney({ expenses: [expense()] });
    renderApp('/expenses');
    const more = await screen.findByRole('navigation', { name: copy.expenses.moreLinks });
    expect(within(more).getByRole('link', { name: copy.expenses.balancesLink })).toHaveAttribute('href', '/expenses/balances');
    expect(within(more).getByRole('link', { name: copy.expenses.settlementsLink })).toHaveAttribute('href', '/expenses/settlements');
    expect(within(more).getByRole('link', { name: copy.expenses.allLink })).toHaveAttribute('href', '/expenses/all');
    expect(screen.queryByRole('link', { name: copy.expenses.recordSettlement })).not.toBeInTheDocument();
  });

  it('filters by category and sorts from the menus', async () => {
    mockMoney({
      expenses: [
        expense({ id: 'a', title: 'Power', category: 'utilities', amountMinor: 100, expenseDate: '2026-05-01' }),
        expense({ id: 'b', title: 'Veg', category: 'groceries', amountMinor: 900, expenseDate: '2026-05-02' }),
      ],
    });
    renderApp('/expenses');
    await screen.findByText('Power');
    const order = () => screen.getAllByText(/^(Power|Veg)$/).map((el) => el.textContent);
    expect(order()).toEqual(['Veg', 'Power']);
    await userEvent.click(screen.getByRole('button', { name: copy.expenses.sort }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: copy.expenses.sortOldest }));
    expect(order()).toEqual(['Power', 'Veg']);
    await userEvent.click(screen.getByRole('button', { name: copy.expenses.filter }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Groceries' }));
    expect(screen.queryByText('Power')).not.toBeInTheDocument();
    expect(screen.getByText('Veg')).toBeInTheDocument();
  });

  it('shares the current list', async () => {
    mockMoney({ expenses: [expense()] });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderApp('/expenses');
    await screen.findByText('Electricity bill');
    await userEvent.click(screen.getByRole('button', { name: copy.expenses.shareLabel }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Electricity bill: ₹1,200.00 (paid by Riya'));
  });

  it('has a loading state, then an error with retry for the list', async () => {
    vi.mocked(expensesApi.listExpenses).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/expenses');
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    vi.mocked(expensesApi.listExpenses).mockResolvedValue({ items: [expense()], hasMore: false });
    await userEvent.click(screen.getAllByRole('button', { name: copy.states.retry })[0]!);
    expect(await screen.findByText('Electricity bill')).toBeInTheDocument();
  });

  it('the floating add button links to the form', async () => {
    mockMoney({ expenses: [expense()] });
    renderApp('/expenses');
    await screen.findByText('Electricity bill');
    expect(screen.getByRole('link', { name: copy.expenses.addExpense })).toHaveAttribute('href', '/expenses/new');
  });

  it('archived household: adding is disabled with the reason', async () => {
    mockMoney({ me: membership({ archived: true }) });
    renderApp('/expenses');
    const fab = await screen.findByRole('button', { name: copy.expenses.addExpense });
    expect(fab).toHaveAttribute('aria-disabled', 'true');
    expect(fab).toHaveAccessibleDescription(copy.errors.householdArchived);
    await userEvent.click(fab);
    expect(screen.getByRole('heading', { level: 1, name: copy.expenses.title })).toBeInTheDocument();
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

describe('Pay and Mark as paid', () => {
  const theirs = () => expense({ id: 'e1', title: 'Wifi', paidByMemberId: 'm-riya' });

  it('To Pay cards have a Pay button that opens the details; To Receive cards do not', async () => {
    mockMoney({ expenses: [theirs(), expense({ id: 'e2', title: 'Milk', paidByMemberId: 'm-aarav' })] });
    renderApp('/expenses');
    const pay = await screen.findByRole('link', { name: copy.expenses.payLabel('Wifi') });
    expect(pay).toHaveTextContent(copy.expenses.pay);
    expect(pay).toHaveAttribute('href', '/expenses/e1');
    await userEvent.click(screen.getByRole('link', { name: /To Receive/ }));
    await screen.findByText('Milk');
    expect(screen.queryByRole('link', { name: /^Pay for/ })).not.toBeInTheDocument();
  });

  it('the details offer Mark as paid, which opens the record-payment form filled with my share', async () => {
    mockMoney({ expenses: [theirs()] });
    vi.mocked(expensesApi.getExpense).mockResolvedValue(theirs());
    renderApp('/expenses/e1');
    expect(await screen.findByText(copy.expenseDetails.yourShareDue('₹400.00', 'Riya'))).toBeInTheDocument();
    expect(screen.getByText(copy.expenseDetails.markPaidNote('Riya'))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.expenseDetails.markPaid }));
    expect(await screen.findByRole('heading', { level: 1, name: copy.settle.title })).toBeInTheDocument();
  });

  it('the person who paid has nothing to mark as paid', async () => {
    mockMoney({ expenses: [expense({ id: 'e2', title: 'Milk', paidByMemberId: 'm-aarav' })] });
    vi.mocked(expensesApi.getExpense).mockResolvedValue(expense({ id: 'e2', title: 'Milk', paidByMemberId: 'm-aarav' }));
    renderApp('/expenses/e2');
    await screen.findByText('Milk');
    expect(screen.queryByRole('button', { name: copy.expenseDetails.markPaid })).not.toBeInTheDocument();
  });

  it('in an archived household Mark as paid is disabled with the reason', async () => {
    mockMoney({ me: membership({ archived: true }), expenses: [theirs()] });
    vi.mocked(expensesApi.getExpense).mockResolvedValue(theirs());
    renderApp('/expenses/e1');
    const button = await screen.findByRole('button', { name: copy.expenseDetails.markPaid });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(copy.errors.householdArchived);
  });
});
