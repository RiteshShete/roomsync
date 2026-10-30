import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as expensesApi from '@/api/expenses';
import * as households from '@/api/households';
import { copy } from '@/copy';
import { expense, mockMoney } from '@/test/money';
import { member, membership, renderApp } from '@/test/render';
import { todayIso } from '@/domain';

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

const amount = () => screen.getByLabelText(/Total amount/);
const title = () => screen.getByLabelText(copy.expenseForm.what);
const save = () => screen.getByRole('button', { name: copy.expenseForm.save });
async function open(path = '/expenses/new') {
  renderApp(path);
  await screen.findByLabelText(copy.expenseForm.what);
}
async function fillBasics(t = 'Dinner', a = '1000') {
  await userEvent.type(title(), t);
  await userEvent.type(amount(), a);
}
const preview = () => screen.getByRole('region', { name: copy.expenseForm.review });

describe('add expense: defaults and validation', () => {
  it('starts with you as payer, everyone selected, today’s date, and Save disabled with the reason', async () => {
    await open();
    expect(screen.getByRole('heading', { level: 1, name: 'Split a new expense' })).toBeInTheDocument();
    expect(screen.getByLabelText(copy.expenseForm.paidBy)).toHaveValue('m-aarav');
    expect(screen.getByLabelText(copy.expenseForm.date)).toHaveValue(todayIso());
    expect(screen.getByText('Split between (3 of 3)')).toBeInTheDocument();
    expect(save()).toHaveAttribute('aria-disabled', 'true');
    expect(save()).toHaveAccessibleDescription(copy.expenseForm.reasonTitle);
  });

  it('the reason changes with what is missing', async () => {
    await open();
    await userEvent.type(title(), 'Dinner');
    expect(save()).toHaveAccessibleDescription(copy.expenseForm.reasonAmount);
    await userEvent.type(amount(), '1000');
    expect(save()).not.toHaveAttribute('aria-disabled');
    await userEvent.click(screen.getByRole('button', { name: copy.expenseForm.clearAll }));
    expect(save()).toHaveAccessibleDescription(copy.expenseForm.reasonPeople);
  });

  it('flags an amount that is not money, and blocks saving', async () => {
    await open();
    await userEvent.type(title(), 'Dinner');
    await userEvent.type(amount(), '12.345');
    expect(screen.getByRole('alert')).toHaveTextContent(copy.validation.amountInvalid);
    expect(save()).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('split preview', () => {
  it('₹1,000 across three people → 333.34 / 333.33 / 333.33 with the rounding explained (manual scenario 2)', async () => {
    await open();
    await fillBasics();
    const p = within(preview());
    expect(p.getByText('Aarav').nextSibling).toHaveTextContent('₹333.34');
    expect(p.getByText('Riya').nextSibling).toHaveTextContent('₹333.33');
    expect(p.getByText('Kunal').nextSibling).toHaveTextContent('₹333.33');
    expect(p.getByText(copy.expenseForm.rounding('₹0.01', 'Aarav'))).toBeInTheDocument();
  });

  it('no rounding note when it divides evenly', async () => {
    await open();
    await fillBasics('Rent', '900');
    expect(within(preview()).queryByText(/extra assigned/)).not.toBeInTheDocument();
  });

  it('deselecting people re-splits among the rest', async () => {
    await open();
    await fillBasics('Taxi', '100');
    await userEvent.click(screen.getByRole('checkbox', { name: /Kunal/ }));
    expect(screen.getByText('Split between (2 of 3)')).toBeInTheDocument();
    const p = within(preview());
    expect(p.getByText('Aarav').nextSibling).toHaveTextContent('₹50.00');
    expect(p.queryByText('Kunal')).not.toBeInTheDocument();
  });

  it('custom amounts: shows what is left, blocks save until exact', async () => {
    await open();
    await fillBasics('Groceries', '1000');
    await userEvent.click(screen.getByRole('radio', { name: copy.expenseForm.methods.custom! }));
    await userEvent.type(screen.getByLabelText(copy.expenseForm.amountFor('Aarav')), '600');
    await userEvent.type(screen.getByLabelText(copy.expenseForm.amountFor('Riya')), '300');
    expect(within(preview()).getByText(copy.expenseForm.remaining('₹100.00'))).toBeInTheDocument();
    expect(save()).toHaveAccessibleDescription(copy.expenseForm.reasonSplit);
    await userEvent.type(screen.getByLabelText(copy.expenseForm.amountFor('Kunal')), '110');
    expect(within(preview()).getByText(copy.expenseForm.over('₹10.00'))).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(copy.expenseForm.amountFor('Kunal')));
    await userEvent.type(screen.getByLabelText(copy.expenseForm.amountFor('Kunal')), '100');
    expect(within(preview()).getByText(copy.expenseForm.adds)).toBeInTheDocument();
    expect(save()).not.toHaveAttribute('aria-disabled');
  });

  it('custom amounts: text that is not a number is flagged', async () => {
    await open();
    await fillBasics('x', '10');
    await userEvent.click(screen.getByRole('radio', { name: copy.expenseForm.methods.custom! }));
    await userEvent.type(screen.getByLabelText(copy.expenseForm.amountFor('Aarav')), 'abc');
    expect(screen.getByLabelText(copy.expenseForm.amountFor('Aarav'))).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(copy.validation.amountInvalid);
  });

  it('percentages: shows the percentage left, then the exact amounts', async () => {
    await open();
    await fillBasics('Wi-Fi', '1000');
    await userEvent.click(screen.getByRole('radio', { name: copy.expenseForm.methods.percentage! }));
    await userEvent.type(screen.getByLabelText(copy.expenseForm.percentFor('Aarav')), '50');
    await userEvent.type(screen.getByLabelText(copy.expenseForm.percentFor('Riya')), '30');
    expect(within(preview()).getByText(copy.expenseForm.percentRemaining('20'))).toBeInTheDocument();
    expect(save()).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(screen.getByLabelText(copy.expenseForm.percentFor('Kunal')), '20');
    const p = within(preview());
    expect(p.getByText('Aarav').nextSibling).toHaveTextContent('₹500.00');
    expect(p.getByText('Riya').nextSibling).toHaveTextContent('₹300.00');
    expect(p.getByText('Kunal').nextSibling).toHaveTextContent('₹200.00');
    expect(p.getByText(copy.expenseForm.adds)).toBeInTheDocument();
    expect(save()).not.toHaveAttribute('aria-disabled');
  });

  it('percentages over 100 are called out', async () => {
    await open();
    await fillBasics('x', '10');
    await userEvent.click(screen.getByRole('radio', { name: copy.expenseForm.methods.percentage! }));
    await userEvent.type(screen.getByLabelText(copy.expenseForm.percentFor('Aarav')), '60');
    await userEvent.type(screen.getByLabelText(copy.expenseForm.percentFor('Riya')), '50');
    expect(within(preview()).getByText(copy.expenseForm.percentOver('10'))).toBeInTheDocument();
  });
});

describe('saving a new expense', () => {
  it('sends exact integer minor units and lands back on Expenses with a success toast', async () => {
    vi.mocked(expensesApi.addExpense).mockResolvedValue('new-id');
    await open();
    await fillBasics('Dinner', '1000');
    await userEvent.selectOptions(screen.getByLabelText(copy.expenseForm.category), 'food');
    await userEvent.type(screen.getByLabelText(new RegExp(copy.expenseForm.notes)), 'Pizza night');
    await userEvent.click(save());
    expect(expensesApi.addExpense).toHaveBeenCalledWith('h1', {
      title: 'Dinner',
      amountMinor: 100000,
      category: 'food',
      paidByMemberId: 'm-aarav',
      expenseDate: todayIso(),
      splitMethod: 'equal',
      notes: 'Pizza night',
      shares: [
        { memberId: 'm-aarav', amountMinor: 33334 },
        { memberId: 'm-riya', amountMinor: 33333 },
        { memberId: 'm-kunal', amountMinor: 33333 },
      ],
    });
    expect(await screen.findByText(copy.expenseForm.saved)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: copy.expenses.title })).toBeInTheDocument();
  });

  it('percentage payloads carry basis points', async () => {
    vi.mocked(expensesApi.addExpense).mockResolvedValue('new-id');
    await open();
    await fillBasics('Wi-Fi', '1000');
    await userEvent.click(screen.getByRole('radio', { name: copy.expenseForm.methods.percentage! }));
    for (const [n, p] of [['Aarav', '50'], ['Riya', '30'], ['Kunal', '20']]) await userEvent.type(screen.getByLabelText(copy.expenseForm.percentFor(n!)), p!);
    await userEvent.click(save());
    const input = vi.mocked(expensesApi.addExpense).mock.calls[0]![1];
    expect(input.splitMethod).toBe('percentage');
    expect(input.shares).toEqual([
      { memberId: 'm-aarav', amountMinor: 50000, percentBp: 5000 },
      { memberId: 'm-riya', amountMinor: 30000, percentBp: 3000 },
      { memberId: 'm-kunal', amountMinor: 20000, percentBp: 2000 },
    ]);
  });

  it('a failed save keeps every field and explains why; a retry then works (rule 6)', async () => {
    vi.mocked(expensesApi.addExpense).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue('new-id');
    await open();
    await fillBasics('Dinner', '1000');
    await userEvent.click(screen.getByRole('checkbox', { name: /Kunal/ }));
    await userEvent.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.network);
    expect(title()).toHaveValue('Dinner');
    expect(amount()).toHaveValue('1000');
    expect(screen.getByText('Split between (2 of 3)')).toBeInTheDocument();
    await userEvent.click(save());
    expect(await screen.findByText(copy.expenseForm.saved)).toBeInTheDocument();
    expect(expensesApi.addExpense).toHaveBeenCalledTimes(2);
  });

  it('shows a busy button and prevents a double submit', async () => {
    let resolve!: (v: string) => void;
    vi.mocked(expensesApi.addExpense).mockReturnValue(new Promise((r) => (resolve = r)));
    await open();
    await fillBasics();
    await userEvent.click(save());
    const busy = await screen.findByRole('button', { name: copy.expenseForm.saving });
    await userEvent.click(busy);
    expect(expensesApi.addExpense).toHaveBeenCalledTimes(1);
    resolve('id');
  });

  it('server-side rejection (e.g. permission) is shown in plain words', async () => {
    vi.mocked(expensesApi.addExpense).mockRejectedValue({ message: 'permission_denied' });
    await open();
    await fillBasics();
    await userEvent.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.permission);
  });

  it('archived household: Save is disabled with the reason', async () => {
    mockMoney({ me: membership({ archived: true }) });
    await open();
    await fillBasics();
    expect(save()).toHaveAttribute('aria-disabled', 'true');
    expect(save()).toHaveAccessibleDescription(copy.errors.householdArchived);
    await userEvent.click(save());
    expect(expensesApi.addExpense).not.toHaveBeenCalled();
  });
});

describe('edit expense', () => {
  beforeEach(() => {
    vi.mocked(expensesApi.getExpense).mockResolvedValue(expense({ id: 'e1', version: 3 }));
  });

  it('prefills from the saved expense and keeps Save disabled until something changes', async () => {
    await open('/expenses/e1/edit');
    expect(screen.getByRole('heading', { level: 1, name: 'Edit expense' })).toBeInTheDocument();
    expect(title()).toHaveValue('Electricity bill');
    expect(amount()).toHaveValue('1200.00');
    expect(screen.getByLabelText(copy.expenseForm.paidBy)).toHaveValue('m-riya');
    expect(save()).toHaveAttribute('aria-disabled', 'true');
    expect(save()).toHaveAccessibleDescription(copy.expenseForm.reasonSame);
  });

  it('saves with the version it loaded, then shows the details with the balance-impact result', async () => {
    vi.mocked(expensesApi.editExpense).mockResolvedValue({ version: 4, settlementsExist: true, impact: [{ memberId: 'm-aarav', beforeMinor: 40000, afterMinor: 30000 }] });
    await open('/expenses/e1/edit');
    await userEvent.clear(amount());
    await userEvent.type(amount(), '900');
    await userEvent.click(save());
    expect(expensesApi.editExpense).toHaveBeenCalledWith('e1', 3, expect.objectContaining({ title: 'Electricity bill', amountMinor: 90000, shares: [{ memberId: 'm-aarav', amountMinor: 30000 }, { memberId: 'm-riya', amountMinor: 30000 }, { memberId: 'm-kunal', amountMinor: 30000 }] }));
    expect(await screen.findByText(copy.expenseForm.updated)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: copy.expenseDetails.impactTitle })).toBeInTheDocument();
    expect(screen.getByText(copy.expenseDetails.impactSettlements)).toBeInTheDocument();
    expect(screen.getByText(copy.expenseDetails.impactLine('Aarav', '₹400.00', '₹300.00'))).toBeInTheDocument();
  });

  it('a version conflict keeps the edits, offers the latest version, and the retry uses it', async () => {
    vi.mocked(expensesApi.editExpense).mockRejectedValueOnce({ message: 'conflict' }).mockResolvedValue({ version: 6, settlementsExist: false, impact: [] });
    await open('/expenses/e1/edit');
    await userEvent.clear(title());
    await userEvent.type(title(), 'Power bill');
    await userEvent.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.conflict);
    expect(title()).toHaveValue('Power bill');
    vi.mocked(expensesApi.getExpense).mockResolvedValue(expense({ id: 'e1', version: 5, title: 'Someone else changed this' }));
    await userEvent.click(screen.getByRole('button', { name: copy.expenseForm.refresh }));
    expect(await screen.findByText(copy.expenseForm.refreshed)).toBeInTheDocument();
    expect(title()).toHaveValue('Power bill');
    await userEvent.click(save());
    await vi.waitFor(() => expect(expensesApi.editExpense).toHaveBeenLastCalledWith('e1', 5, expect.objectContaining({ title: 'Power bill' })));
  });

  it('a plain member cannot edit someone else’s expense and is told why', async () => {
    mockMoney({ me: membership({ role: 'member', memberId: 'm-kunal' }) });
    vi.mocked(expensesApi.getExpense).mockResolvedValue(expense({ id: 'e1', createdBy: 'u-riya' }));
    renderApp('/expenses/e1/edit');
    expect(await screen.findByText(copy.expenseDetails.noPermission)).toBeInTheDocument();
    expect(screen.queryByLabelText(copy.expenseForm.what)).not.toBeInTheDocument();
  });

  it('a deleted expense cannot be edited', async () => {
    vi.mocked(expensesApi.getExpense).mockResolvedValue(expense({ id: 'e1', deletedAt: '2026-05-02T10:00:00Z' }));
    renderApp('/expenses/e1/edit');
    expect(await screen.findByRole('heading', { name: copy.expenses.deleted })).toBeInTheDocument();
    expect(screen.queryByLabelText(copy.expenseForm.what)).not.toBeInTheDocument();
  });

  it('keeps people who have left in the split, marked, and does not offer them for new splits', async () => {
    const sneha = member({ memberId: 'm-sneha', userId: 'u-sneha', role: 'member', status: 'left' as never, displayName: 'Sneha' });
    mockMoney({ members: [member(), member({ memberId: 'm-riya', userId: 'u-riya', role: 'admin', displayName: 'Riya' }), sneha] });
    vi.mocked(households.listAllMembers).mockResolvedValue([
      member() as households.MemberWithLeft,
      member({ memberId: 'm-riya', userId: 'u-riya', role: 'admin', displayName: 'Riya' }) as households.MemberWithLeft,
      { ...sneha, status: 'left' } as households.MemberWithLeft,
    ]);
    vi.mocked(expensesApi.getExpense).mockResolvedValue(
      expense({ shares: [{ memberId: 'm-aarav', shareAmountMinor: 40000, percentBp: null }, { memberId: 'm-riya', shareAmountMinor: 40000, percentBp: null }, { memberId: 'm-sneha', shareAmountMinor: 40000, percentBp: null }] }),
    );
    renderApp('/expenses/e1/edit');
    await screen.findByLabelText(copy.expenseForm.what);
    expect(screen.getByRole('checkbox', { name: /Sneha/ })).toBeChecked();
    expect(screen.getByText(copy.expenseForm.leftChip)).toBeInTheDocument();
  });

  it('shows a not-found message for an expense that is not visible', async () => {
    vi.mocked(expensesApi.getExpense).mockRejectedValue({ message: 'not_found', code: 'PGRST116' });
    renderApp('/expenses/zzz/edit');
    expect(await screen.findByText(copy.expenseDetails.notFoundTitle)).toBeInTheDocument();
  });
});
