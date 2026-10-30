import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { markPurchased, moveBackToNeeded, restoreGrocery, type GroceryItem } from '@/api/groceries';
import { copy } from '@/copy';
import { errorMessage, toAppError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useDirectory } from '@/features/household/useDirectory';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { Avatar, Button, Chip, EmptyState, ErrorState, Fab, Header, Icon, IconButton, MenuButton, ShareButton, SkeletonList, useToast } from '@/ui';
import { useGroceries, useInvalidateGroceries } from './hooks';
import { ItemSheet } from './ItemSheet';
import { arrange, groupByCategory, quantityText, shareListText, type GrocerySort } from './listModel';

type Tab = 'needed' | 'purchased';

const pad = (n: number) => String(n).padStart(2, '0');

/** Category header tint: produce is peach, dairy is blue, everything else neutral. */
const BAND: Record<string, string> = { 'Fruits and Veggies': 'bg-band-peach text-success-text', Dairy: 'bg-band-blue text-info' };

/** Shopping tab, from the design: one card with the progress, To Buy / Bought tabs with Filter and Sort, and collapsible category groups. */
export function GroceriesScreen() {
  const access = useHouseholdAccess();
  const dir = useDirectory(access?.householdId);
  const list = useGroceries(access?.householdId);
  const toast = useToast();
  const invalidate = useInvalidateGroceries();
  const [tab, setTab] = useState<Tab>('needed');
  const [sheet, setSheet] = useState<{ item?: GroceryItem; key: number } | null>(null);
  const [seq, setSeq] = useState(0);
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<GrocerySort>('recent');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

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
  const inTab = tab === 'needed' ? needed : purchased;
  const shown = arrange(inTab, category, sort);
  const pct = items.length === 0 ? 0 : Math.round((purchased.length / items.length) * 100);
  const blocked = access.writeBlockedReason;
  const openSheet = (item?: GroceryItem) => {
    setSeq((n) => n + 1);
    setSheet({ item, key: seq + 1 });
  };
  const categories = [...new Set(items.map((i) => i.category ?? copy.groceries.uncategorised))];
  const toggle = (c: string) => setCollapsed((prev) => (prev.has(c) ? new Set([...prev].filter((x) => x !== c)) : new Set([...prev, c])));
  const everyone = dir.members.filter((m) => m.status !== 'left').map((m) => ({ name: m.displayName, color: m.avatarColor }));

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
      <div className="flex flex-col gap-1 pb-3">
        {groupByCategory(shown).map(([cat, rows]) => {
          const open = !collapsed.has(cat);
          return (
            <section key={cat} aria-label={cat}>
              <h2 className={`mx-3 my-1 flex items-center gap-2 rounded-lg ${BAND[cat] ?? 'bg-sunken text-ink'} px-3 py-2 text-sm font-bold`}>
                <Icon name={cat === 'Fruits and Veggies' ? 'leaf' : 'cart'} size={20} />
                <span className="min-w-0 truncate text-ink-strong">{cat}</span>
                <Chip tone="success">{rows.length}</Chip>
                <button type="button" aria-expanded={open} aria-label={open ? copy.groceries.collapse(cat) : copy.groceries.expand(cat)} onClick={() => toggle(cat)} className="-my-2 -mr-2 ml-auto flex h-11 w-11 cursor-pointer items-center justify-center text-coral">
                  <Icon name="chevronDown" size={20} className={open ? 'rotate-180' : ''} />
                </button>
              </h2>
              {open ? (
                <ul className="divide-y divide-line">
                  {rows.map((i) => {
                    const isNeeded = i.status === 'needed';
                    const working = (buy.isPending && buy.variables?.id === i.id) || (back.isPending && back.variables?.id === i.id);
                    const label = isNeeded ? copy.groceries.markPurchased(i.name) : copy.groceries.moveBack(i.name);
                    const buyer = i.purchasedByMemberId ? dir.member(i.purchasedByMemberId) : undefined;
                    return (
                      <li key={i.id} className="flex min-h-16 items-center gap-2.5 px-4 py-2">
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
                          <p className="text-base break-words text-ink-strong">
                            {i.name}
                            {quantityText(i) ? <span className="ml-2 text-xs font-bold whitespace-nowrap text-success-text">{quantityText(i)}</span> : null}
                          </p>
                          <p className="text-xs break-words text-ink2">
                            {isNeeded ? copy.groceries.addedBy(dir.nameOf(i.addedByMemberId)) : copy.groceries.boughtBy(dir.nameOf(i.purchasedByMemberId), i.purchasedAt ? formatDateTime(i.purchasedAt) : '')}
                          </p>
                          {i.note ? <p className="truncate text-xs text-ink2">{i.note}</p> : null}
                        </div>
                        {isNeeded ? (
                          <span className="flex shrink-0 items-center gap-1.5 text-sm text-ink">
                            <span aria-hidden="true" className="inline-flex">
                              {everyone.slice(0, 3).map((m, n) => (
                                <span key={m.name + n} className={n === 0 ? '' : '-ml-2'}>
                                  <Avatar name={m.name} color={m.color} size="xs" ring />
                                </span>
                              ))}
                            </span>
                            <span className="hidden min-[380px]:inline">{copy.groceries.anyone}</span>
                          </span>
                        ) : buyer ? (
                          <span className="flex min-w-0 shrink-0 items-center gap-1.5 text-sm text-ink">
                            <Avatar name={buyer.displayName} color={buyer.avatarColor} size="xs" />
                            <span className="hidden max-w-20 truncate min-[380px]:inline">{buyer.displayName}</span>
                          </span>
                        ) : null}
                        <IconButton label={copy.groceries.edit(i.name)} icon={<Icon name="dots" size={22} />} onClick={() => openSheet(i)} className="-mr-3 !w-9 text-ink" />
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    );

  return (
    <>
      <Header title={copy.groceries.title} right={<ShareButton label={copy.groceries.shareLabel} title={copy.groceries.shareTitle} build={() => shareListText(copy.groceries.shareTitle, needed)} />} />
      <div className="p-4 pb-24">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {items.length > 0 ? (
            <section aria-label={copy.groceries.progress} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line p-4">
              <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary">
                <Icon name="cart" size={26} />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-ink">{copy.groceries.progress}</p>
                <p className="flex items-baseline gap-1.5">
                  <span className="sr-only">{copy.groceries.progressOf(purchased.length, items.length)}</span>
                  <span aria-hidden="true" className="text-3xl leading-none font-bold text-coral">{purchased.length}</span>
                  <span aria-hidden="true" className="text-xs text-ink2">/ {items.length}</span>
                  <span aria-hidden="true" className="text-xs font-bold text-ink-strong">{copy.groceries.purchasedWord}</span>
                </p>
              </div>
              <div className="flex min-w-32 flex-1 items-center gap-3">
                <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={copy.groceries.progress} className="h-2 flex-1 overflow-hidden rounded-full bg-track">
                  <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-bold text-success-text">{pct}%</span>
              </div>
            </section>
          ) : null}

          {items.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-x-2 px-4">
              <div role="tablist" aria-label={copy.groceries.title} className="flex gap-4">
                {([['needed', copy.groceries.toBuy, needed.length], ['purchased', copy.groceries.bought, purchased.length]] as const).map(([key, label, n]) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={`min-h-11 cursor-pointer border-b-2 text-base ${tab === key ? 'border-primary font-bold text-coral' : 'border-transparent text-ink'}`}
                  >
                    {label} ({pad(n)})
                  </button>
                ))}
              </div>
              <div className="flex items-center">
                <MenuButton label={copy.groceries.filter} options={[{ value: '', label: copy.groceries.allCategories }, ...categories.map((c) => ({ value: c, label: c }))]} value={category} onChange={setCategory} />
                <MenuButton label={copy.groceries.sort} icon="sort" options={[{ value: 'recent', label: copy.groceries.sortRecent }, { value: 'name', label: copy.groceries.sortName }]} value={sort} onChange={setSort} />
              </div>
            </div>
          ) : null}

          {body}
        </div>
      </div>

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
    </>
  );
}
