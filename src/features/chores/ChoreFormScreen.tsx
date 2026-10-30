import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cancelChore, createChore, updateChore, type Chore } from '@/api/chores';
import type { MemberWithLeft } from '@/api/households';
import { copy } from '@/copy';
import { CHORE_CATEGORIES, CHORE_PRIORITIES, type ChorePriority, type RecurrenceFrequency } from '@/domain';
import { errorMessage, toAppError, saveErrorMessage } from '@/lib/errors';
import { useSession } from '@/features/auth/Session';
import { useFreshDirectory } from '@/features/household/useDirectory';
import { SubPage } from '@/features/shell/SubPage';
import { useHouseholdAccess, type HouseholdAccess } from '@/features/household/useMembership';
import { Avatar, Button, ButtonRow, ConfirmDialog, EmptyState, ErrorState, Field, FormError, Icon, SelectField, SkeletonList, Toggle, useToast, type IconName } from '@/ui';
import { checkChoreForm, emptyChoreState, inputFromChore, moveInOrder, rotationOf, sameChoreInput, stateFromChore, type ChoreFormState } from './formModel';
import { useChore, useInvalidateChores } from './hooks';

const FREQ: { value: '' | RecurrenceFrequency; label: string }[] = [
  { value: '', label: copy.chores.noRepeat },
  { value: 'daily', label: copy.chores.repeats.daily! },
  { value: 'weekly', label: copy.chores.repeats.weekly! },
  { value: 'biweekly', label: copy.chores.repeats.biweekly! },
  { value: 'monthly', label: copy.chores.repeats.monthly! },
];

const PRIORITY_ICON: Record<ChorePriority, IconName> = { low: 'chevronDown', medium: 'equal', high: 'chevronUp' };

const CATEGORY_OPTIONS = [{ value: '', label: copy.chores.noCategory }, ...CHORE_CATEGORIES.map((c) => ({ value: c, label: copy.chores.categories[c]! }))];

/** One setting in the design's tinted row card: a small icon, then the control. */
function Row({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-peach-line bg-field p-3">
      <Icon name={icon} size={22} className="mt-3 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Form({ access, members, chore, userId }: { access: HouseholdAccess; members: MemberWithLeft[]; chore?: Chore; userId: string | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateChores();
  const selectable = members.filter((m) => m.status !== 'left').map((m) => m.memberId);
  const nameOf = (id: string) => members.find((m) => m.memberId === id)?.displayName ?? 'Former member';

  const [state, setState] = useState<ChoreFormState>(() => (chore ? stateFromChore(chore, selectable) : emptyChoreState(selectable, access.memberId)));
  const [baseVersion, setBaseVersion] = useState(chore?.version ?? 0);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const patch = (p: Partial<ChoreFormState>) => setState((s) => ({ ...s, ...p }));

  const check = checkChoreForm(state);
  const unchanged = !!chore && check.input !== null && sameChoreInput(check.input, inputFromChore(chore));
  const blocked = access.writeBlockedReason ?? (!check.ok ? check.reason : unchanged ? copy.chores.reasonSame : null);
  const canCancel = !!chore && (access.isAdmin || chore.createdBy === userId);
  const rotating = state.recurrence !== '' && state.rotate;
  const assigneeOptions = [
    { value: '', label: copy.chores.unassigned },
    ...members.filter((m) => m.status !== 'left' || m.memberId === state.assignee).map((m) => ({ value: m.memberId, label: m.memberId === access.memberId ? `${m.displayName} (${copy.members.you})` : m.displayName })),
  ];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || blocked || !check.input) return;
    setBusy(true);
    setFormError(null);
    setConflict(false);
    try {
      if (chore) await updateChore(chore.id, baseVersion, check.input);
      else await createChore(access.householdId, userId!, check.input);
      await invalidate();
      toast.show({ message: chore ? copy.chores.updated : copy.chores.created });
      navigate('/chores', { replace: true });
    } catch (err) {
      setConflict(toAppError(err).code === 'conflict');
      setFormError(saveErrorMessage(err)); // everything typed stays
    } finally {
      setBusy(false);
    }
  }

  async function onCancelChore() {
    if (!chore || cancelBusy) return;
    setCancelBusy(true);
    try {
      await cancelChore(chore.id, baseVersion);
      await invalidate();
      setConfirmCancel(false);
      toast.show({ message: copy.chores.cancelled });
      navigate('/chores', { replace: true });
    } catch (err) {
      setConfirmCancel(false);
      toast.show({ tone: 'error', message: errorMessage(err) });
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-xl border border-peach-line bg-surface p-4">
        <div>
          <h2 className="text-xl font-bold text-ink-strong">{chore ? copy.chores.editTitle : copy.chores.newTitle}</h2>
          <p className="text-sm text-ink2">{copy.chores.subtitle}</p>
        </div>
        <Field label={copy.chores.what} placeholder={copy.chores.whatPlaceholder} autoComplete="off" maxLength={130} value={state.title} onChange={(e) => patch({ title: e.target.value })} />
        <Field label={copy.chores.description} optional maxLength={1000} value={state.description} onChange={(e) => patch({ description: e.target.value })} />
      </section>
      <section className="flex flex-col gap-3 border-t border-line pt-4">
        <Row icon="plus">
          <SelectField label={copy.chores.categoryLabel} options={CATEGORY_OPTIONS} value={state.category} onChange={(e) => patch({ category: e.target.value as ChoreFormState['category'] })} />
        </Row>
        <Row icon="user">
          <SelectField label={copy.chores.assignee} options={assigneeOptions} value={state.assignee} onChange={(e) => patch({ assignee: e.target.value })} />
        </Row>
        <Row icon="calendar">
          <Field label={copy.chores.dueDate} hint={copy.chores.dueHint} type="date" value={state.dueDate} onChange={(e) => patch({ dueDate: e.target.value })} />
        </Row>
        <Row icon="swap">
          <SelectField
            label={copy.chores.repeat}
            options={FREQ}
            value={state.recurrence}
            onChange={(e) => patch({ recurrence: e.target.value as ChoreFormState['recurrence'], ...(e.target.value === '' ? { rotate: false } : {}) })}
          />
        </Row>
        <Row icon="alert">
          <fieldset>
            <legend className="mb-1.5 text-sm font-bold text-ink">{copy.chores.priorityLabel}</legend>
            <div role="radiogroup" aria-label={copy.chores.priorityLabel} className="grid grid-cols-3 gap-2">
              {CHORE_PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={state.priority === p}
                  onClick={() => patch({ priority: p })}
                  className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 text-sm font-semibold ${state.priority === p ? 'border-success-text bg-success-text text-white' : 'border-line bg-surface text-ink'}`}
                >
                  <Icon name={PRIORITY_ICON[p]} size={16} className={state.priority === p ? '' : p === 'high' ? 'text-danger' : ''} />
                  {copy.chores.priorities[p]}
                </button>
              ))}
            </div>
          </fieldset>
        </Row>
      </section>

      {state.recurrence !== '' ? (
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <Toggle label={copy.chores.rotate} description={copy.chores.rotateHint} checked={state.rotate} onChange={(v) => patch({ rotate: v })} />
          {rotating ? (
            <>
              <h2 className="text-base font-bold text-ink">{copy.chores.rotationOrder}</h2>
              <ol className="flex flex-col divide-y divide-line">
                {state.order.map((id, i) => {
                  const m = members.find((x) => x.memberId === id);
                  const on = state.included.includes(id);
                  return (
                    <li key={id} className="flex min-h-14 items-center gap-2 py-1.5">
                      <input
                        id={`rot-${id}`}
                        type="checkbox"
                        checked={on}
                        aria-label={copy.chores.inRotation(nameOf(id))}
                        onChange={() => patch({ included: on ? state.included.filter((x) => x !== id) : [...state.included, id] })}
                        className="h-6 w-6 shrink-0 cursor-pointer accent-[var(--success)]"
                      />
                      <Avatar name={nameOf(id)} color={m?.avatarColor} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-base text-ink">{nameOf(id)}</span>
                      <Button variant="tertiary" className="px-3" aria-label={copy.chores.moveUp(nameOf(id))} disabled={i === 0} disabledReason="Already first" onClick={() => patch({ order: moveInOrder(state.order, id, -1) })}>
                        ↑
                      </Button>
                      <Button variant="tertiary" className="px-3" aria-label={copy.chores.moveDown(nameOf(id))} disabled={i === state.order.length - 1} disabledReason="Already last" onClick={() => patch({ order: moveInOrder(state.order, id, 1) })}>
                        ↓
                      </Button>
                    </li>
                  );
                })}
              </ol>
              <p className="text-sm text-ink2">{copy.chores.orderLine(rotationOf(state).map(nameOf).join(' → '))}</p>
            </>
          ) : null}
        </section>
      ) : null}

      <FormError message={formError} />
      {conflict && chore ? <ConflictRefresh id={chore.id} onRefreshed={(v) => { setBaseVersion(v); setConflict(false); setFormError(copy.chores.refreshed); }} /> : null}
      <ButtonRow className="rounded-xl border border-peach-line bg-strip p-3">
        <Button variant="secondary" onClick={() => navigate('/chores')}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} loadingLabel={copy.chores.saving} disabled={!!blocked} disabledReason={blocked ?? undefined}>
          {copy.chores.save}
        </Button>
      </ButtonRow>
      {blocked ? <p className="text-center text-sm text-ink2">{blocked}</p> : null}

      {chore ? (
        <Button variant="danger" fullWidth disabled={!canCancel || !!access.writeBlockedReason} disabledReason={access.writeBlockedReason ?? 'Only the person who created this chore, or an owner or admin, can cancel it.'} showReason={!canCancel} onClick={() => setConfirmCancel(true)}>
          {copy.chores.cancel}
        </Button>
      ) : null}
      <ConfirmDialog open={confirmCancel} title={copy.chores.cancelTitle} confirmLabel={copy.chores.cancelConfirm} cancelLabel={copy.chores.cancelKeep} destructive loading={cancelBusy} onCancel={() => setConfirmCancel(false)} onConfirm={() => void onCancelChore()}>
        {copy.chores.cancelBody}
      </ConfirmDialog>
    </form>
  );
}

/** After a version conflict: fetch the latest version number but keep everything the user typed. */
function ConflictRefresh({ id, onRefreshed }: { id: string; onRefreshed: (version: number) => void }) {
  const latest = useChore(id);
  return (
    <Button variant="secondary" loading={latest.isFetching} onClick={async () => { const r = await latest.refetch(); if (r.data) onRefreshed(r.data.version); }}>
      {copy.chores.refresh}
    </Button>
  );
}

/** Create (/chores/new) and edit (/chores/:id/edit) share one screen. */
export function ChoreFormScreen() {
  const { id } = useParams();
  const editing = !!id;
  const access = useHouseholdAccess();
  const dir = useFreshDirectory(access?.householdId);
  const chore = useChore(id);
  const session = useSession();
  const userId = session.status === 'signedIn' ? session.user.id : null;

  if (!access) return null;
  const wrap = (children: React.ReactNode) => (
    <SubPage title={copy.chores.title} backTo="/chores">
      {children}
    </SubPage>
  );
  if (dir.isPending || (editing && chore.isPending)) return wrap(<SkeletonList rows={4} />);
  if (dir.isError || (editing && chore.isError)) {
    const gone = editing && chore.isError && toAppError(chore.error).code !== 'network';
    return wrap(gone ? <EmptyState title={copy.chores.notFoundTitle} body={copy.chores.notFoundBody} /> : <ErrorState message={errorMessage(dir.error ?? chore.error)} onRetry={() => { void dir.refetch(); void chore.refetch(); }} />);
  }
  if (editing && chore.data) {
    const c = chore.data;
    if (c.status !== 'open') return wrap(<EmptyState title={copy.chores.notFoundTitle} body={copy.chores.notFoundBody} />);
    if (!(access.isAdmin || c.createdBy === userId || c.assigneeMemberId === access.memberId)) return wrap(<EmptyState title={copy.chores.edit} body={copy.chores.noPermissionEdit} />);
  }
  return wrap(<Form access={access} members={dir.members} chore={editing ? chore.data : undefined} userId={userId} />);
}
