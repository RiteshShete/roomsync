import type { ReactNode } from 'react';
import { copy } from '@/copy';
import { errorMessage } from '@/lib/errors';
import { useChores } from '@/features/chores/hooks';
import { useBalances, useMoney, useSettlements } from '@/features/expenses/hooks';
import { useGroceries } from '@/features/groceries/hooks';
import { useDirectory } from '@/features/household/useDirectory';
import type { HouseholdAccess } from '@/features/household/useMembership';
import { SkeletonList } from '@/ui';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <h3 id={id} className="text-base font-bold text-ink">
        {title}
      </h3>
      {children}
    </section>
  );
}

const Failed = ({ error }: { error: unknown }) => (
  <p role="alert" className="text-sm font-semibold text-danger">
    {errorMessage(error)}
  </p>
);

/**
 * What is still open for one member: their balance (an estimate), open chores, payments in dispute and
 * grocery items they added. Read-only. RoomSync does not compute deposits or mark anything paid.
 */
export function OutstandingSummary({ access }: { access: HouseholdAccess }) {
  const balances = useBalances(access.householdId);
  const settlements = useSettlements(access.householdId);
  const chores = useChores(access.householdId);
  const groceries = useGroceries(access.householdId);
  const dir = useDirectory(access.householdId);
  const { fmt } = useMoney();
  const me = access.memberId;

  const net = balances.data?.find((b) => b.memberId === me)?.netMinor ?? 0;
  const myChores = chores.data?.open.filter((c) => c.assigneeMemberId === me) ?? [];
  const disputed = settlements.data?.filter((s) => s.status === 'disputed' && (s.fromMemberId === me || s.toMemberId === me)) ?? [];
  const myItems = groceries.data?.filter((g) => g.status === 'needed' && g.addedByMemberId === me).length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <Section id="mo-balance" title={copy.moveOut.balanceTitle}>
        {balances.error ? (
          <Failed error={balances.error} />
        ) : balances.isPending ? (
          <SkeletonList rows={1} />
        ) : (
          <>
            <p className="text-lg font-bold text-ink-strong">{net < 0 ? copy.moveOut.balanceOwe(fmt(-net)) : net > 0 ? copy.moveOut.balanceOwed(fmt(net)) : copy.moveOut.balanceZero}</p>
            <p className="text-sm text-ink2">{copy.moveOut.balanceNote}</p>
          </>
        )}
      </Section>

      <Section id="mo-chores" title={copy.moveOut.choresTitle}>
        {chores.error ? (
          <Failed error={chores.error} />
        ) : chores.isPending ? (
          <SkeletonList rows={1} />
        ) : myChores.length === 0 ? (
          <p className="text-base text-ink">{copy.moveOut.choresNone}</p>
        ) : (
          <>
            <p className="text-base text-ink">{copy.moveOut.choresSome(myChores.length)}</p>
            <ul className="list-disc pl-5 text-base text-ink">
              {myChores.map((c) => (
                <li key={c.id}>{c.title}</li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section id="mo-disputed" title={copy.moveOut.disputedTitle}>
        {settlements.error ? (
          <Failed error={settlements.error} />
        ) : settlements.isPending || dir.isPending ? (
          <SkeletonList rows={1} />
        ) : disputed.length === 0 ? (
          <p className="text-base text-ink">{copy.moveOut.disputedNone}</p>
        ) : (
          <>
            <ul className="list-disc pl-5 text-base text-ink">
              {disputed.map((s) => (
                <li key={s.id}>{copy.moveOut.disputedLine(dir.nameOf(s.fromMemberId), dir.nameOf(s.toMemberId), fmt(s.amountMinor))}</li>
              ))}
            </ul>
            <p className="text-sm text-ink2">{copy.moveOut.disputedNote}</p>
          </>
        )}
      </Section>

      <Section id="mo-groceries" title={copy.moveOut.groceriesTitle}>
        {groceries.error ? <Failed error={groceries.error} /> : groceries.isPending ? <SkeletonList rows={1} /> : <p className="text-base text-ink">{myItems === 0 ? copy.moveOut.groceriesNone : copy.moveOut.groceriesSome(myItems)}</p>}
      </Section>
    </div>
  );
}
