import { useState } from 'react';
import type { ExpenseFilters } from '@/api/expenses';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { SubPage } from '@/features/shell/SubPage';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { Button, EmptyState, ErrorState, Field, Icon, SelectField, Sheet, SkeletonList, Toggle } from '@/ui';
import { CATEGORY_OPTIONS } from './categories';
import { ExpenseCard } from './ExpenseCard';
import { useDirectory } from '@/features/household/useDirectory';
import { useExpenses, useMoney } from './hooks';

function activeCount(f: ExpenseFilters): number {
  return [f.from, f.to, f.category, f.payerId, f.participantId].filter(Boolean).length + (f.includeDeleted ? 1 : 0);
}

/** All expenses, newest first, paginated, with date/category/payer/participant filters and a deleted toggle. */
export function ExpenseListScreen() {
  const access = useHouseholdAccess();
  const { fmt } = useMoney();
  const dir = useDirectory(access?.householdId);
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [draft, setDraft] = useState<ExpenseFilters>({});
  const [open, setOpen] = useState(false);
  const query = useExpenses(access?.householdId, filters);

  if (!access) return null;
  const count = activeCount(filters);
  const people = [{ value: '', label: copy.expenses.anyone }, ...dir.members.map((m) => ({ value: m.memberId, label: m.displayName }))];
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  const openFilters = () => {
    setDraft(filters);
    setOpen(true);
  };
  const apply = () => {
    setFilters(Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== '' && v !== undefined && v !== false)) as ExpenseFilters);
    setOpen(false);
  };

  let body;
  if (query.isPending || dir.isPending) body = <SkeletonList rows={4} />;
  else if (query.isError) body = <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  else if (items.length === 0)
    body =
      count > 0 ? (
        <EmptyState
          title={copy.expenses.noMatchesTitle}
          body={copy.expenses.noMatchesBody}
          action={
            <Button variant="secondary" onClick={() => setFilters({})}>
              {copy.expenses.clearFilters}
            </Button>
          }
        />
      ) : (
        <EmptyState title={copy.expenses.emptyTitle} body={copy.expenses.emptyBody} />
      );
  else
    body = (
      <>
        <ul className="flex flex-col gap-3">
          {items.map((e) => (
            <li key={e.id}>
              <ExpenseCard expense={e} fmt={fmt} nameOf={dir.nameOf} avatarOf={(id) => dir.member(id)?.avatarColor} myMemberId={access.memberId} />
            </li>
          ))}
        </ul>
        {query.hasNextPage ? (
          <Button variant="secondary" fullWidth loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            {copy.expenses.loadMore}
          </Button>
        ) : null}
      </>
    );

  return (
    <SubPage
      title={copy.expenses.allTitle}
      backTo="/expenses"
      right={
        <Button variant="tertiary" icon={<Icon name="filter" size={18} />} onClick={openFilters}>
          {count > 0 ? copy.expenses.filtersActive(count) : copy.expenses.filters}
        </Button>
      }
    >
      {body}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={copy.expenses.filtersTitle}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft({});
                setFilters({});
                setOpen(false);
              }}
            >
              {copy.expenses.clearFilters}
            </Button>
            <Button onClick={apply}>{copy.expenses.apply}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 pb-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label={copy.expenses.dateFrom} type="date" value={draft.from ?? ''} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
            <Field label={copy.expenses.dateTo} type="date" value={draft.to ?? ''} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
          </div>
          <SelectField
            label={copy.expenses.category}
            options={[{ value: '', label: copy.expenses.anyCategory }, ...CATEGORY_OPTIONS]}
            value={draft.category ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
          />
          <SelectField label={copy.expenses.payer} options={people} value={draft.payerId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, payerId: e.target.value }))} />
          <SelectField label={copy.expenses.participant} options={people} value={draft.participantId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, participantId: e.target.value }))} />
          <Toggle
            label={copy.expenses.includeDeleted}
            description={copy.expenses.includeDeletedHint}
            checked={!!draft.includeDeleted}
            onChange={(v) => setDraft((d) => ({ ...d, includeDeleted: v }))}
          />
        </div>
      </Sheet>
    </SubPage>
  );
}
