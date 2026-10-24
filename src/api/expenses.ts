import type { ExpenseRecord, SettlementRecord, SplitMethod } from '@/domain';
import { toAppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export interface ExpenseShareRow {
  memberId: string;
  shareAmountMinor: number;
  percentBp: number | null;
}

export interface Expense {
  id: string;
  title: string;
  amountMinor: number;
  currencyCode: string;
  category: string;
  paidByMemberId: string;
  expenseDate: string;
  notes: string | null;
  splitMethod: SplitMethod;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  version: number;
  shares: ExpenseShareRow[];
}

const COLUMNS =
  'id, title, amount_minor, currency_code, category, paid_by_member_id, expense_date, notes, split_method, created_by, updated_by, created_at, updated_at, deleted_at, deleted_by, version, expense_shares(member_id, share_amount_minor, percent_bp)';

type Row = {
  id: string;
  title: string;
  amount_minor: number;
  currency_code: string;
  category: string;
  paid_by_member_id: string;
  expense_date: string;
  notes: string | null;
  split_method: string;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  version: number;
  expense_shares: { member_id: string; share_amount_minor: number; percent_bp: number | null }[];
};

function toExpense(r: Row): Expense {
  return {
    id: r.id,
    title: r.title,
    amountMinor: r.amount_minor,
    currencyCode: r.currency_code,
    category: r.category,
    paidByMemberId: r.paid_by_member_id,
    expenseDate: r.expense_date,
    notes: r.notes,
    splitMethod: r.split_method as SplitMethod,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    deletedBy: r.deleted_by,
    version: r.version,
    shares: [...r.expense_shares]
      .map((s) => ({ memberId: s.member_id, shareAmountMinor: s.share_amount_minor, percentBp: s.percent_bp }))
      .sort((a, b) => a.memberId.localeCompare(b.memberId)),
  };
}

export interface ExpenseFilters {
  from?: string;
  to?: string;
  category?: string;
  payerId?: string;
  participantId?: string;
  includeDeleted?: boolean;
}

export const PAGE_SIZE = 20;

/** One page of expenses, newest first. Paginated: never an unbounded list (PLAN Phase 9). */
export async function listExpenses(householdId: string, filters: ExpenseFilters, page: number): Promise<{ items: Expense[]; hasMore: boolean }> {
  const supabase = getSupabase();
  let ids: string[] | null = null;
  if (filters.participantId) {
    const { data, error } = await supabase
      .from('expense_shares')
      .select('expense_id')
      .eq('household_id', householdId)
      .eq('member_id', filters.participantId)
      .limit(2000);
    if (error) throw toAppError(error);
    ids = data.map((r) => r.expense_id);
    if (ids.length === 0) return { items: [], hasMore: false };
  }
  let q = supabase.from('expenses').select(COLUMNS).eq('household_id', householdId);
  if (!filters.includeDeleted) q = q.is('deleted_at', null);
  if (filters.from) q = q.gte('expense_date', filters.from);
  if (filters.to) q = q.lte('expense_date', filters.to);
  if (filters.category) q = q.eq('category', filters.category);
  if (filters.payerId) q = q.eq('paid_by_member_id', filters.payerId);
  if (ids) q = q.in('id', ids);
  const { data, error } = await q
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE); // one extra row tells us whether another page exists
  if (error) throw toAppError(error);
  const rows = data as unknown as Row[];
  return { items: rows.slice(0, PAGE_SIZE).map(toExpense), hasMore: rows.length > PAGE_SIZE };
}

export async function getExpense(id: string): Promise<Expense> {
  const { data, error } = await getSupabase().from('expenses').select(COLUMNS).eq('id', id).single();
  if (error) throw toAppError(error);
  return toExpense(data as unknown as Row);
}

export interface HistoryEntry {
  id: string;
  action: string;
  actorMemberId: string | null;
  createdAt: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export async function listExpenseHistory(expenseId: string): Promise<HistoryEntry[]> {
  const { data, error } = await getSupabase()
    .from('audit_events')
    .select('id, action, actor_member_id, created_at, before, after')
    .eq('entity_type', 'expense')
    .eq('entity_id', expenseId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw toAppError(error);
  return data.map((r) => ({
    id: r.id,
    action: r.action,
    actorMemberId: r.actor_member_id,
    createdAt: r.created_at,
    before: r.before as Record<string, unknown> | null,
    after: r.after as Record<string, unknown> | null,
  }));
}

export interface ExpenseInput {
  title: string;
  amountMinor: number;
  category: string;
  paidByMemberId: string;
  expenseDate: string;
  splitMethod: SplitMethod;
  notes?: string | null;
  shares: { memberId: string; amountMinor: number; percentBp?: number }[];
}

const sharesJson = (input: ExpenseInput) =>
  input.shares.map((s) => ({
    member_id: s.memberId,
    share_amount_minor: s.amountMinor,
    ...(s.percentBp !== undefined ? { percent_bp: s.percentBp } : {}),
  }));

export async function addExpense(householdId: string, input: ExpenseInput): Promise<string> {
  const { data, error } = await getSupabase().rpc('add_expense', {
    p_household_id: householdId,
    p_title: input.title,
    p_amount_minor: input.amountMinor,
    p_category: input.category,
    p_paid_by_member_id: input.paidByMemberId,
    p_expense_date: input.expenseDate,
    p_split_method: input.splitMethod,
    p_shares: sharesJson(input),
    p_notes: input.notes ?? undefined,
  });
  if (error) throw toAppError(error);
  return data;
}

export interface EditResult {
  version: number;
  settlementsExist: boolean;
  impact: { memberId: string; beforeMinor: number; afterMinor: number }[];
}

export async function editExpense(expenseId: string, expectedVersion: number, input: ExpenseInput): Promise<EditResult> {
  const { data, error } = await getSupabase().rpc('edit_expense', {
    p_expense_id: expenseId,
    p_expected_version: expectedVersion,
    p_title: input.title,
    p_amount_minor: input.amountMinor,
    p_category: input.category,
    p_paid_by_member_id: input.paidByMemberId,
    p_expense_date: input.expenseDate,
    p_split_method: input.splitMethod,
    p_shares: sharesJson(input),
    p_notes: input.notes ?? undefined,
  });
  if (error) throw toAppError(error);
  const r = data as { version: number; settlements_exist: boolean; impact: { member_id: string; before_minor: number; after_minor: number }[] };
  return {
    version: r.version,
    settlementsExist: r.settlements_exist,
    impact: r.impact.map((i) => ({ memberId: i.member_id, beforeMinor: i.before_minor, afterMinor: i.after_minor })),
  };
}

export async function deleteExpense(expenseId: string, expectedVersion?: number): Promise<number> {
  const { data, error } = await getSupabase().rpc('delete_expense', { p_expense_id: expenseId, p_expected_version: expectedVersion });
  if (error) throw toAppError(error);
  return data;
}

export async function restoreExpense(expenseId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('restore_expense', { p_expense_id: expenseId });
  if (error) throw toAppError(error);
  return data;
}

export interface BalanceRow {
  memberId: string;
  netMinor: number;
}

/** Net balance per member (positive = is owed). Computed in the database (PLAN D3, D8). */
export async function getBalances(householdId: string): Promise<BalanceRow[]> {
  const { data, error } = await getSupabase().rpc('household_balances', { p_household_id: householdId });
  if (error) throw toAppError(error);
  return data.map((r) => ({ memberId: r.member_id, netMinor: Number(r.net_minor) }));
}

const BALANCE_ROW_CAP = 2000;

/**
 * Everything that moves one member's balance, in the shape `explainBalance` expects, so the
 * "Why do I owe this?" lines can be summed and checked against the database's net. Only the
 * member's own share of each expense is fetched. `truncated` is true if a cap was hit.
 */
export async function getBalanceInputs(
  householdId: string,
  memberId: string,
): Promise<{ expenses: ExpenseRecord[]; settlements: SettlementRecord[]; truncated: boolean }> {
  const supabase = getSupabase();
  const [paid, shares, settled] = await Promise.all([
    supabase.from('expenses').select('id, title, amount_minor').eq('household_id', householdId).eq('paid_by_member_id', memberId).is('deleted_at', null).limit(BALANCE_ROW_CAP),
    supabase
      .from('expense_shares')
      .select('expense_id, share_amount_minor, expenses!inner(id, title, amount_minor, paid_by_member_id, deleted_at)')
      .eq('household_id', householdId)
      .eq('member_id', memberId)
      .is('expenses.deleted_at', null)
      .limit(BALANCE_ROW_CAP),
    supabase
      .from('settlements')
      .select('id, from_member_id, to_member_id, amount_minor, status')
      .eq('household_id', householdId)
      .eq('status', 'recorded')
      .or(`from_member_id.eq.${memberId},to_member_id.eq.${memberId}`)
      .limit(BALANCE_ROW_CAP),
  ]);
  if (paid.error) throw toAppError(paid.error);
  if (shares.error) throw toAppError(shares.error);
  if (settled.error) throw toAppError(settled.error);

  const byId = new Map<string, ExpenseRecord>();
  for (const p of paid.data) byId.set(p.id, { id: p.id, title: p.title, amountMinor: p.amount_minor, paidBy: memberId, shares: [] });
  for (const s of shares.data) {
    const e = (Array.isArray(s.expenses) ? s.expenses[0] : s.expenses)!;
    const rec: ExpenseRecord = byId.get(e.id) ?? { id: e.id, title: e.title, amountMinor: e.amount_minor, paidBy: e.paid_by_member_id, shares: [] };
    rec.shares.push({ memberId, amountMinor: s.share_amount_minor });
    byId.set(e.id, rec);
  }
  return {
    expenses: [...byId.values()],
    settlements: settled.data.map((r) => ({ id: r.id, from: r.from_member_id, to: r.to_member_id, amountMinor: r.amount_minor, status: 'recorded' as const })),
    truncated: paid.data.length >= BALANCE_ROW_CAP || shares.data.length >= BALANCE_ROW_CAP || settled.data.length >= BALANCE_ROW_CAP,
  };
}
