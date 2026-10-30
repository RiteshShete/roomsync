import { useId, useState, type FormEvent } from 'react';
import { addGrocery, deleteGrocery, markPurchased, moveBackToNeeded, updateGrocery, type GroceryInput, type GroceryItem } from '@/api/groceries';
import { copy } from '@/copy';
import { findDuplicate } from '@/domain';
import { toAppError, saveErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { useDirectory } from '@/features/household/useDirectory';
import { Avatar, Button, Field, FormError, Icon, SelectField, Sheet, useToast } from '@/ui';
import { useInvalidateGroceries } from './hooks';

const QTY = /^\d+(?:\.\d{1,3})?$/;
const CATEGORY_OPTIONS = copy.groceries.categories.map((c) => ({ value: c, label: c }));
const UNIT_OPTIONS = [{ value: '', label: '—' }, ...copy.groceries.units.map((u) => ({ value: u, label: u }))];

interface Draft {
  name: string;
  category: string;
  quantity: string;
  unit: string;
  note: string;
}

const draftOf = (i?: GroceryItem): Draft => ({
  name: i?.name ?? '',
  category: i?.category ?? 'Other',
  quantity: i?.quantity === null || i?.quantity === undefined ? '' : String(i.quantity),
  unit: i?.unit ?? '',
  note: i?.note ?? '',
});

function toInput(d: Draft): GroceryInput | null {
  const qty = d.quantity.trim();
  if (qty !== '' && (!QTY.test(qty) || Number(qty) <= 0)) return null;
  return {
    name: d.name.trim(),
    quantity: qty === '' ? null : Number(qty),
    unit: qty === '' || d.unit === '' ? null : d.unit,
    category: d.category,
    note: d.note.trim() === '' ? null : d.note.trim(),
  };
}

const qtyText = (i: { quantity: number | null; unit: string | null }) => (i.quantity === null ? '' : ` (${i.quantity}${i.unit ? ` ${i.unit}` : ''})`);

/**
 * Add / edit sheet. Adding checks the Needed list for a same-named item and offers "Update existing"
 * or "Add anyway". Edit mode also offers Delete (with Undo, handled by the caller) and Move back.
 */
export function ItemSheet({
  open,
  item,
  needed,
  householdId,
  myMemberId,
  blockedReason,
  onClose,
  onDeleted,
  onConflict,
}: {
  open: boolean;
  item?: GroceryItem;
  needed: GroceryItem[];
  householdId: string;
  myMemberId: string;
  blockedReason: string | null;
  onClose: () => void;
  onDeleted: (item: GroceryItem) => void;
  onConflict: () => void;
}) {
  // The parent remounts this with a key per item, so local state starts fresh each time.
  const toast = useToast();
  const formId = useId();
  const dir = useDirectory(householdId);
  const invalidate = useInvalidateGroceries();
  const [draft, setDraft] = useState<Draft>(() => draftOf(item));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<GroceryItem | null>(null);
  const [touched, setTouched] = useState(false);
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const input = toInput(draft);
  const nameBlank = draft.name.trim() === '';
  const reason = blockedReason ?? (nameBlank ? copy.groceries.reasonName : input === null ? copy.groceries.reasonQuantity : null);

  async function run(work: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setFormError(null);
    try {
      await work();
      await invalidate();
      if (success) toast.show({ message: success });
      onClose();
    } catch (err) {
      if (toAppError(err).code === 'conflict') {
        await invalidate();
        onConflict();
        onClose();
      } else setFormError(saveErrorMessage(err)); // the sheet and every field stay as they were
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (busy || reason || !input) return;
    if (item) return void run(() => updateGrocery(item.id, item.version, input), copy.groceries.updated);
    const dup = findDuplicate(needed, input.name);
    if (dup) return void setDuplicate(dup);
    void run(() => addGrocery(householdId, myMemberId, input), copy.groceries.added);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? copy.groceries.editTitle : copy.groceries.addTitle}
      hideTitle
      footerClassName="!flex-row !bg-strip [&>*]:flex-1"
      footer={
        duplicate ? undefined : (
          <>
            {item ? (
              item.status === 'purchased' ? (
                <Button variant="secondary" className="px-2 text-sm" disabled={!!blockedReason} disabledReason={blockedReason ?? undefined} icon={<Icon name="check" size={18} />} onClick={() => void run(() => moveBackToNeeded(item.id, item.version), copy.groceries.movedBackToast(item.name))}>
                  {copy.groceries.moveBack(item.name)}
                </Button>
              ) : (
                <Button variant="secondary" className="px-2 text-sm" disabled={!!blockedReason} disabledReason={blockedReason ?? undefined} icon={<Icon name="check" size={18} />} onClick={() => void run(() => markPurchased(item.id, item.version, myMemberId), copy.groceries.purchasedToast(item.name))}>
                  {copy.groceries.markChecked}
                </Button>
              )
            ) : null}
            <Button type="submit" form={formId} loading={busy} loadingLabel={copy.groceries.saving} disabled={!!reason} disabledReason={reason ?? undefined}>
              {copy.groceries.save}
            </Button>
          </>
        )
      }
    >
      {duplicate ? (
        <div className="flex flex-col gap-3 pb-2" role="group" aria-labelledby="dup-title">
          <h3 id="dup-title" className="text-base font-bold text-ink">
            {copy.groceries.duplicateTitle}
          </h3>
          <p className="text-base text-ink2">{copy.groceries.duplicateBody(duplicate.name, qtyText(duplicate))}</p>
          <FormError message={formError} />
          <Button
            fullWidth
            loading={busy}
            onClick={() =>
              input &&
              void run(
                () =>
                  updateGrocery(duplicate.id, duplicate.version, {
                    name: duplicate.name,
                    quantity: input.quantity ?? duplicate.quantity,
                    unit: input.quantity === null ? duplicate.unit : input.unit,
                    category: input.category ?? duplicate.category,
                    note: input.note ?? duplicate.note,
                  }),
                copy.groceries.updated,
              )
            }
          >
            {copy.groceries.updateExisting}
          </Button>
          <Button variant="secondary" fullWidth loading={busy} onClick={() => input && void run(() => addGrocery(householdId, myMemberId, input), copy.groceries.added)}>
            {copy.groceries.addAnyway}
          </Button>
        </div>
      ) : (
        <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-col gap-4 pb-2">
          <div className="flex items-start gap-3 border-b border-line pr-12 pb-4">
            <div className="min-w-0 flex-1">
              <label htmlFor={`${formId}-name`} className="sr-only">
                {copy.groceries.name}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`${formId}-name`}
                  data-autofocus
                  autoComplete="off"
                  maxLength={130}
                  placeholder={copy.groceries.namePlaceholder}
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  aria-invalid={touched && nameBlank ? true : undefined}
                  aria-describedby={`${formId}-name-hint`}
                  className={`min-h-11 min-w-0 flex-1 rounded-xl border bg-field px-3 text-lg text-ink-strong placeholder:text-ink3/70 ${touched && nameBlank ? 'border-danger' : 'border-field-line'}`}
                />
                <Icon name="pen" size={20} className="shrink-0 text-primary" />
              </div>
              <p id={`${formId}-name-hint`} className="mt-1.5 text-xs text-ink2">
                {copy.groceries.nameHint}
              </p>
              {touched && nameBlank ? (
                <p role="alert" className="mt-1 text-sm font-semibold text-danger">
                  {copy.groceries.reasonName}
                </p>
              ) : null}
            </div>
          </div>
          <SelectField label={copy.groceries.category} options={CATEGORY_OPTIONS} value={draft.category} onChange={(e) => set({ category: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={copy.groceries.quantity} optional inputMode="decimal" placeholder="e.g. 2" value={draft.quantity} onChange={(e) => set({ quantity: e.target.value })} error={draft.quantity.trim() !== '' && input === null ? copy.groceries.reasonQuantity : null} />
            <SelectField label={copy.groceries.unit} options={UNIT_OPTIONS} value={draft.unit} onChange={(e) => set({ unit: e.target.value })} />
          </div>
          <Field label={copy.groceries.note} optional hint={copy.groceries.noteHint} maxLength={500} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
          {item ? (
            <div className="flex items-center gap-3 border-t border-line pt-4">
              <Avatar name={dir.nameOf(item.addedByMemberId)} color={dir.member(item.addedByMemberId)?.avatarColor} size="md" />
              <div className="min-w-0">
                <p className="text-xs text-ink2">{copy.groceries.addedByLabel}</p>
                <p className="truncate text-base font-bold text-ink-strong">{dir.nameOf(item.addedByMemberId)}</p>
                <p className="text-xs text-ink2">{formatRelative(item.createdAt)}</p>
              </div>
            </div>
          ) : null}
          <FormError message={formError} />
          {item ? (
            <Button variant="tertiary" className="text-danger" fullWidth disabled={!!blockedReason} disabledReason={blockedReason ?? undefined} onClick={() => void run(async () => { await deleteGrocery(item.id, item.version); onDeleted(item); })}>
              {copy.groceries.delete}
            </Button>
          ) : null}
        </form>
      )}
    </Sheet>
  );
}
