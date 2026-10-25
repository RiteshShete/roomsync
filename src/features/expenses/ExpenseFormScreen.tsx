import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addExpense, editExpense, type Expense } from '@/api/expenses';
import type { DefaultSplit, MemberWithLeft } from '@/api/households';
import { copy } from '@/copy';
import { formatMoney, formatPercentBp, parsePercentBp, todayIso, type SplitMethod } from '@/domain';
import { errorMessage, toAppError } from '@/lib/errors';
import { useSession } from '@/features/auth/Session';
import { SubPage } from '@/features/shell/SubPage';
import { useHousehold, useHouseholdAccess, type HouseholdAccess } from '@/features/household/useMembership';
import { AmountInput, Avatar, Button, Chip, EmptyState, ErrorState, Field, FormError, SelectField, SkeletonList, useToast } from '@/ui';
import { CATEGORY_OPTIONS } from './categories';
import { checkForm, computeSplit, inputFromExpense, sameInput, stateFromExpense, type ExpenseFormState } from './formModel';
import { useFreshDirectory } from '@/features/household/useDirectory';
import { useExpense, useInvalidateMoney } from './hooks';

const METHODS: SplitMethod[] = ['equal', 'custom', 'percentage'];
const SMALL_INPUT = 'min-h-11 w-28 rounded-xl border border-field-line bg-field px-3 text-right text-base text-ink';

function Form({ access, members, expense, defaultSplit }: { access: HouseholdAccess; members: MemberWithLeft[]; expense?: Expense; defaultSplit: DefaultSplit }) {
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateMoney();
  const { currencyCode: currency, memberId: myId } = access;
  const money = (m: number) => formatMoney(m, currency);

  const order = useMemo(() => members.map((m) => m.memberId), [members]);
  const present = members.filter((m) => m.status !== 'left' || expense?.shares.some((s) => s.memberId === m.memberId) || expense?.paidByMemberId === m.memberId);
  const activeIds = members.filter((m) => m.status !== 'left').map((m) => m.memberId);

  const [state, setState] = useState<ExpenseFormState>(() =>
    expense
      ? stateFromExpense(expense, currency)
      : { title: '', amountMinor: null, date: todayIso(), category: 'other', paidBy: myId, selected: activeIds, method: defaultSplit, customRaw: {}, percentRaw: {}, notes: '' },
  );
  const [baseVersion, setBaseVersion] = useState(expense?.version ?? 0);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const patch = (p: Partial<ExpenseFormState>) => setState((s) => ({ ...s, ...p }));

  const preview = computeSplit(state, order, currency);
  const check = checkForm(state, order, currency);
  const unchanged = !!expense && check.input !== null && sameInput(check.input, inputFromExpense(expense));
  const result = preview.result;
  const shareOf = new Map(result?.shares.map((s) => [s.memberId, s.amountMinor]));
  const nameOf = (id: string) => members.find((m) => m.memberId === id)?.displayName ?? 'Former member';

  const toggle = (id: string) => patch({ selected: state.selected.includes(id) ? state.selected.filter((x) => x !== id) : [...state.selected, id] });

  const blockedReason = access.writeBlockedReason ?? (!check.ok ? check.reason : unchanged ? copy.expenseForm.reasonSame : null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (busy || blockedReason || !check.input) return;
    setBusy(true);
    setFormError(null);
    setConflict(false);
    try {
      if (expense) {
        const r = await editExpense(expense.id, baseVersion, check.input);
        await invalidate();
        toast.show({ message: copy.expenseForm.updated });
        navigate(`/expenses/${expense.id}`, { replace: true, state: { edit: r } });
      } else {
        await addExpense(access.householdId, check.input);
        await invalidate();
        toast.show({ message: copy.expenseForm.saved });
        navigate('/expenses', { replace: true });
      }
    } catch (err) {
      setConflict(toAppError(err).code === 'conflict');
      setFormError(errorMessage(err)); // every field stays exactly as typed
    } finally {
      setBusy(false);
    }
  }

  const methodLabel = (m: string) => copy.expenseForm.methods[m]!;
  const roundingNames = result?.roundingRecipients.map(nameOf).join(', ') ?? '';

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
        <Field
          label={copy.expenseForm.what}
          placeholder={copy.expenseForm.whatPlaceholder}
          autoComplete="off"
          maxLength={130}
          value={state.title}
          onChange={(e) => patch({ title: e.target.value })}
          error={touched && check.problem === 'title' ? check.reason : null}
        />
        <AmountInput
          label={copy.expenseForm.amount}
          currency={currency}
          valueMinor={state.amountMinor}
          onChange={(m) => patch({ amountMinor: m })}
          error={touched && check.problem === 'amount' ? check.reason : null}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label={copy.expenseForm.date} type="date" value={state.date} onChange={(e) => patch({ date: e.target.value })} />
          <SelectField
            label={copy.expenseForm.paidBy}
            options={present.map((m) => ({ value: m.memberId, label: m.memberId === myId ? `${m.displayName} (${copy.members.you})` : m.displayName }))}
            value={state.paidBy}
            onChange={(e) => patch({ paidBy: e.target.value })}
          />
        </div>
        <SelectField label={copy.expenseForm.category} options={CATEGORY_OPTIONS} value={state.category} onChange={(e) => patch({ category: e.target.value })} />
      </section>

      <section aria-labelledby="split-between" className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="split-between" className="text-base font-bold text-ink">
            {copy.expenseForm.splitBetween} ({state.selected.length} of {present.length})
          </h2>
          <button
            type="button"
            onClick={() => patch({ selected: state.selected.length === present.length ? [] : present.map((m) => m.memberId) })}
            className="min-h-11 cursor-pointer px-2 text-sm font-semibold text-coral"
          >
            {state.selected.length === present.length ? copy.expenseForm.clearAll : copy.expenseForm.selectAll}
          </button>
        </div>

        <div role="radiogroup" aria-label={copy.expenseForm.method} className="mb-4 grid grid-cols-3 gap-2">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={state.method === m}
              onClick={() => patch({ method: m })}
              className={`min-h-11 cursor-pointer rounded-xl border px-2 text-sm ${state.method === m ? 'border-primary bg-brand-soft font-bold text-coral' : 'border-line bg-surface font-normal text-ink'}`}
            >
              {methodLabel(m)}
            </button>
          ))}
        </div>

        <ul className="flex flex-col divide-y divide-line">
          {present.map((m) => {
            const on = state.selected.includes(m.memberId);
            const bad = preview.badMembers.includes(m.memberId);
            const left = m.status === 'left';
            return (
              <li key={m.memberId} className="flex min-h-14 items-center gap-3 py-2">
                <input
                  id={`p-${m.memberId}`}
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(m.memberId)}
                  disabled={left && !on}
                  className="h-6 w-6 shrink-0 cursor-pointer accent-[var(--success)]"
                />
                <label htmlFor={`p-${m.memberId}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <Avatar name={m.displayName} color={m.avatarColor} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-base text-ink">
                      {m.displayName}
                      {m.memberId === myId ? ` (${copy.members.you})` : ''}
                    </span>
                    {left ? <Chip tone="warning">{copy.expenseForm.leftChip}</Chip> : null}
                  </span>
                </label>
                {on && state.method === 'custom' ? (
                  <input
                    inputMode="decimal"
                    aria-label={copy.expenseForm.amountFor(m.displayName)}
                    aria-invalid={bad || undefined}
                    placeholder="0.00"
                    className={`${SMALL_INPUT} ${bad ? 'border-danger' : ''}`}
                    value={state.customRaw[m.memberId] ?? ''}
                    onChange={(e) => patch({ customRaw: { ...state.customRaw, [m.memberId]: e.target.value } })}
                  />
                ) : null}
                {on && state.method === 'percentage' ? (
                  <span className="flex items-center gap-1">
                    <input
                      inputMode="decimal"
                      aria-label={copy.expenseForm.percentFor(m.displayName)}
                      aria-invalid={bad || undefined}
                      placeholder="0"
                      className={`${SMALL_INPUT} w-20 ${bad ? 'border-danger' : ''}`}
                      value={state.percentRaw[m.memberId] ?? ''}
                      onChange={(e) => patch({ percentRaw: { ...state.percentRaw, [m.memberId]: e.target.value } })}
                    />
                    <span aria-hidden="true">%</span>
                  </span>
                ) : null}
                {on && state.method === 'equal' && shareOf.has(m.memberId) ? <span className="text-base font-bold text-success">{money(shareOf.get(m.memberId)!)}</span> : null}
              </li>
            );
          })}
        </ul>
        {touched && check.problem === 'people' ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger">
            {check.reason}
          </p>
        ) : null}
        {preview.badInput ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger">
            {state.method === 'percentage' ? copy.expenseForm.percentInvalid : copy.validation.amountInvalid}
          </p>
        ) : null}
      </section>

      {result ? (
        <section aria-labelledby="split-preview" className="rounded-xl border border-line bg-surface p-4">
          <h2 id="split-preview" className="mb-2 text-base font-bold text-ink">
            {copy.expenseForm.review}
          </h2>
          <ul className="flex flex-col gap-1">
            {result.shares.map((s) => (
              <li key={s.memberId} className="flex justify-between text-base">
                <span className="text-ink">{nameOf(s.memberId)}</span>
                <span className="font-bold text-ink">
                  {money(s.amountMinor)}
                  {state.method === 'percentage' ? <span className="font-normal text-ink2"> · {formatPercentBp(percentOf(state, s.memberId))}%</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {state.method === 'custom' ? (
            result.difference === 0 ? (
              <p className="mt-2 text-sm font-semibold text-success-text">{copy.expenseForm.adds}</p>
            ) : (
              <p role="status" className="mt-2 text-sm font-semibold text-danger">
                {result.difference > 0 ? copy.expenseForm.remaining(money(result.difference)) : copy.expenseForm.over(money(-result.difference))}
              </p>
            )
          ) : null}
          {state.method === 'percentage' ? (
            result.difference === 0 ? (
              <p className="mt-2 text-sm font-semibold text-success-text">{copy.expenseForm.adds}</p>
            ) : (
              <p role="status" className="mt-2 text-sm font-semibold text-danger">
                {result.difference > 0 ? copy.expenseForm.percentRemaining(formatPercentBp(result.difference)) : copy.expenseForm.percentOver(formatPercentBp(-result.difference))}
              </p>
            )
          ) : null}
          {result.ok && result.roundingRecipients.length > 0 ? <p className="mt-2 text-sm text-ink2">{copy.expenseForm.rounding(money(1), roundingNames)}</p> : null}
        </section>
      ) : null}

      <Field label={copy.expenseForm.notes} optional maxLength={1000} value={state.notes} onChange={(e) => patch({ notes: e.target.value })} />

      <FormError message={formError} />
      {conflict && expense ? <ConflictRefresh expenseId={expense.id} onRefreshed={(v) => { setBaseVersion(v); setConflict(false); setFormError(copy.expenseForm.refreshed); }} /> : null}
      <div className="flex gap-3 rounded-xl bg-strip p-3">
        <Button variant="secondary" className="flex-1" onClick={() => navigate(expense ? `/expenses/${expense.id}` : '/expenses')}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" loading={busy} loadingLabel={copy.expenseForm.saving} disabled={!!blockedReason} disabledReason={blockedReason ?? undefined}>
          {copy.expenseForm.save}
        </Button>
      </div>
      {blockedReason ? <p className="text-center text-sm text-ink2">{blockedReason}</p> : null}
    </form>
  );
}

function percentOf(state: ExpenseFormState, id: string): number {
  return parsePercentBp(state.percentRaw[id] ?? '') ?? 0;
}

/** After a version conflict: fetch the latest version number but keep everything the user typed. */
function ConflictRefresh({ expenseId, onRefreshed }: { expenseId: string; onRefreshed: (version: number) => void }) {
  const latest = useExpense(expenseId);
  return (
    <Button variant="secondary" loading={latest.isFetching} onClick={async () => { const r = await latest.refetch(); if (r.data) onRefreshed(r.data.version); }}>
      {copy.expenseForm.refresh}
    </Button>
  );
}

/** Add (/expenses/new) and edit (/expenses/:id/edit) share one screen. */
export function ExpenseFormScreen() {
  const { id } = useParams();
  const access = useHouseholdAccess();
  const dir = useFreshDirectory(access?.householdId);
  const household = useHousehold(access?.householdId);
  const expense = useExpense(id);
  const session = useSession();
  const editing = !!id;
  const title = editing ? copy.expenseForm.editTitle : copy.expenseForm.newTitle;
  const back = editing ? `/expenses/${id}` : '/expenses';

  if (!access) return null;
  if (dir.isPending || household.isPending || (editing && expense.isPending))
    return <SubPage title={title} backTo={back}><SkeletonList rows={4} /></SubPage>;
  if (dir.isError || household.isError || (editing && expense.isError)) {
    const err = dir.error ?? household.error ?? expense.error;
    const notFound = editing && expense.isError && toAppError(expense.error).code !== 'network';
    return (
      <SubPage title={title} backTo={back}>
        {notFound ? <EmptyState title={copy.expenseDetails.notFoundTitle} body={copy.expenseDetails.notFoundBody} /> : <ErrorState message={errorMessage(err)} onRetry={() => { void dir.refetch(); void household.refetch(); void expense.refetch(); }} />}
      </SubPage>
    );
  }
  if (editing && expense.data) {
    const mine = session.status === 'signedIn' && expense.data.createdBy === session.user.id;
    if (expense.data.deletedAt) return <SubPage title={title} backTo={back}><EmptyState title={copy.expenses.deleted} body={copy.expenseDetails.deletedBanner('', '')} /></SubPage>;
    if (!access.isAdmin && !mine) return <SubPage title={title} backTo={back}><EmptyState title={copy.expenseDetails.edit} body={copy.expenseDetails.noPermission} /></SubPage>;
  }

  return (
    <SubPage title={title} backTo={back}>
      <Form access={access} members={dir.members} expense={editing ? expense.data : undefined} defaultSplit={household.data!.defaultSplit} />
    </SubPage>
  );
}
