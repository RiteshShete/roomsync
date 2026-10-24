import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { markPurchased, moveBackToNeeded, restoreGrocery, type GroceryItem } from '@/api/groceries';
import { copy } from '@/copy';
import { errorMessage, toAppError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useDirectory } from '@/features/expenses/hooks';
import { SubPage } from '@/features/shell/SubPage';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { Button, Chip, EmptyState, ErrorState, Fab, SkeletonList, useToast } from '@/ui';
import { useGroceries, useInvalidateGroceries } from './hooks';
import { ItemSheet } from './ItemSheet';

type Tab = 'needed' | 'purchased';

const qty = (i: GroceryItem) => (i.quantity === null ? '' : `${i.quantity}${i.unit ? ` ${i.unit}` : ''}`);

/** House → Grocery list: Needed and Purchased, grouped by category, with a shopping-progress bar. */
export function GroceriesScreen() {
  const access = useHouseholdAccess();
  const dir = useDirectory(access?.householdId);
  const list = useGroceries(access?.householdId);
  const toast = useToast();
  const invalidate = useInvalidateGroceries();
  const [tab, setTab] = useState<Tab>('needed');
  const [sheet, setSheet] = useState<{ item?: GroceryItem; key: number } | null>(null);
  const [seq, setSeq] = useState(0);

  const onConflict = () => toast.show({ tone: 'error', message: copy.groceries.conflict });
  const fail = async (err: unknown) => {
    if (toAppError(err).code === 'conflict') {
      await invalidate();
      onConflict();
    } else toast.show({ tone: 'error', message: errorMessage(err) });
  };

  const buy = useMutation({
    mutationFn: (i: GroceryItem) => markPurchased(i.id, i.version, access!.memberId),
    onSuccess: async (_v, i) => {
      await invalidate();
      toast.show({ message: copy.groceries.purchasedToast(i.name) });
    },
    onError: fail,
  });
  const back = useMutation({
    mutationFn: (i: GroceryItem) => moveBackToNeeded(i.id, i.version),
    onSuccess: async (_v, i) => {
      await invalidate();
      toast.show({ message: copy.groceries.movedBackToast(i.name) });
    },
    onError: fail,
  });
  const restore = useMutation({
    mutationFn: (i: GroceryItem) => restoreGrocery(i.id),
    onSuccess: async (_v, i) => {
      await invalidate();
      toast.show({ message: copy.groceries.restored(i.name) });
    },
    onError: (err) => toast.show({ tone: 'error', message: errorMessage(err) }),
  });

  if (!access) return null;
  const items = list.data ?? [];
  const needed = items.filter((i) => i.status === 'needed');
  const purchased = items.filter((i) => i.status === 'purchased');
  const shown = tab === 'needed' ? needed : purchased;
  const pct = items.length === 0 ? 0 : Math.round((purchased.length / items.length) * 100);
  const blocked = access.writeBlockedReason;
  const openSheet = (item?: GroceryItem) => {
    setSeq((n) => n + 1);
    setSheet({ item, key: seq + 1 });
  };

  const groups = new Map<string, GroceryItem[]>();
  for (const i of shown) {
    const key = i.category ?? copy.groceries.uncategorised;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }

  let body;
  if (list.isPending || dir.isPending) body = <SkeletonList rows={4} />;
  else if (list.isError) body = <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />;
  else if (items.length === 0)
    body = (
      <EmptyState
        title={copy.groceries.emptyTitle}
        body={copy.groceries.emptyBody}
        action={
          <Button disabled={!!blocked} disabledReason={blocked ?? undefined} showReason onClick={() => openSheet()}>
            {copy.groceries.add}
          </Button>
        }
      />
    );
  else if (shown.length === 0) body = tab === 'needed' ? <EmptyState title={copy.groceries.emptyTitle} body={copy.groceries.emptyBody} /> : <EmptyState title={copy.groceries.emptyPurchasedTitle} body={copy.groceries.emptyPurchasedBody} />;
  else
    body = (
      <div className="flex flex-col gap-4">
        {[...groups.entries()].map(([category, rows]) => (
          <section key={category} aria-label={category} className="overflow-hidden rounded-xl border border-line bg-surface">
            <h2 className="flex items-center gap-2 bg-tint px-3 py-2 text-base font-bold text-ink">
              {category}
              <Chip tone="success">{rows.length}</Chip>
            </h2>
            <ul className="divide-y divide-line">
              {rows.map((i) => {
                const isNeeded = i.status === 'needed';
                const working = (buy.isPending && buy.variables?.id === i.id) || (back.isPending && back.variables?.id === i.id);
                const label = isNeeded ? copy.groceries.markPurchased(i.name) : copy.groceries.moveBack(i.name);
                return (
                  <li key={i.id} className="flex min-h-16 items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!isNeeded}
                      aria-label={label}
                      aria-disabled={!!blocked || working || undefined}
                      title={blocked ?? label}
                      onChange={() => {
                        if (blocked || working) return;
                        if (isNeeded) buy.mutate(i);
                        else back.mutate(i);
                      }}
                      className="h-6 w-6 shrink-0 cursor-pointer accent-[var(--success)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg text-ink-strong">
                        {i.name}
                        {qty(i) ? <span className="ml-2 text-sm font-semibold text-success-text">{qty(i)}</span> : null}
                      </p>
                      <p className="truncate text-sm text-ink2">
                        {isNeeded ? copy.groceries.addedBy(dir.nameOf(i.addedByMemberId)) : copy.groceries.boughtBy(dir.nameOf(i.purchasedByMemberId), i.purchasedAt ? formatDateTime(i.purchasedAt) : '')}
                      </p>
                      {i.note ? <p className="truncate text-sm text-ink2">{i.note}</p> : null}
                    </div>
                    <Button variant="tertiary" className="px-3" aria-label={copy.groceries.edit(i.name)} onClick={() => openSheet(i)}>
                      {copy.chores.edit}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    );

  return (
    <SubPage title={copy.groceries.title} backTo="/house">
      {items.length > 0 ? (
        <section aria-label={copy.groceries.progress} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base text-ink">{copy.groceries.progress}</p>
            <p className="text-sm font-bold text-success-text">{copy.groceries.progressOf(purchased.length, items.length)}</p>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={copy.groceries.progress} className="mt-2 h-2 overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
          </div>
        </section>
      ) : null}

      {items.length > 0 ? (
        <div role="tablist" aria-label={copy.groceries.title} className="flex gap-6 border-b border-line">
          {([['needed', copy.groceries.needed, needed.length], ['purchased', copy.groceries.purchased, purchased.length]] as const).map(([key, label, n]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`min-h-11 cursor-pointer border-b-2 pb-0.5 text-base ${tab === key ? 'border-primary font-bold text-coral' : 'border-transparent font-normal text-ink'}`}
            >
              {label} ({n})
            </button>
          ))}
        </div>
      ) : null}

      {body}

      <Fab onClick={() => openSheet()} label={copy.groceries.add} disabledReason={blocked ?? undefined} />
      {sheet ? (
        <ItemSheet
          key={sheet.key}
          open
          item={sheet.item}
          needed={needed}
          householdId={access.householdId}
          myMemberId={access.memberId}
          blockedReason={blocked}
          onClose={() => setSheet(null)}
          onConflict={onConflict}
          onDeleted={(i) => toast.show({ message: copy.groceries.deleted(i.name), action: { label: copy.groceries.undo, onClick: () => restore.mutate(i) } })}
        />
      ) : null}
    </SubPage>
  );
}
