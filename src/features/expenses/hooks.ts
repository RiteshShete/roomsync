import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBalanceInputs, getBalances, getExpense, listExpenseHistory, listExpenses, PAGE_SIZE, type ExpenseFilters } from '@/api/expenses';
import { listAllMembers, type MemberWithLeft } from '@/api/households';
import { listSettlements } from '@/api/settlements';
import { formatMoney } from '@/domain';
import { useHouseholdAccess } from '@/features/household/useMembership';

export function useAllMembers(householdId: string | undefined) {
  return useQuery({
    queryKey: ['members-all', householdId],
    queryFn: () => listAllMembers(householdId!),
    enabled: !!householdId,
    staleTime: 0,
  });
}

export function useBalances(householdId: string | undefined) {
  return useQuery({
    queryKey: ['balances', householdId],
    queryFn: () => getBalances(householdId!),
    enabled: !!householdId,
    staleTime: 0,
  });
}

export function useBalanceInputs(householdId: string | undefined, memberId: string | undefined) {
  return useQuery({
    queryKey: ['balance-inputs', householdId, memberId],
    queryFn: () => getBalanceInputs(householdId!, memberId!),
    enabled: !!householdId && !!memberId,
    staleTime: 0,
  });
}

export function useExpenses(householdId: string | undefined, filters: ExpenseFilters) {
  return useInfiniteQuery({
    queryKey: ['expenses', householdId, filters],
    queryFn: ({ pageParam }) => listExpenses(householdId!, filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasMore ? all.length : undefined),
    enabled: !!householdId,
    staleTime: 0,
  });
}

export function useExpense(expenseId: string | undefined) {
  return useQuery({ queryKey: ['expense', expenseId], queryFn: () => getExpense(expenseId!), enabled: !!expenseId, staleTime: 0 });
}

export function useExpenseHistory(expenseId: string | undefined) {
  return useQuery({ queryKey: ['expense-history', expenseId], queryFn: () => listExpenseHistory(expenseId!), enabled: !!expenseId, staleTime: 0 });
}

export function useSettlements(householdId: string | undefined) {
  return useQuery({ queryKey: ['settlements', householdId], queryFn: () => listSettlements(householdId!), enabled: !!householdId, staleTime: 0 });
}

/** After anything that changes money, everything derived from it must refetch. */
export function useInvalidateMoney() {
  const client = useQueryClient();
  return () =>
    Promise.all(
      ['balances', 'balance-inputs', 'expenses', 'expense', 'expense-history', 'settlements', 'household-has-money'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

export { PAGE_SIZE };

/** Name lookup by member id or user id, tolerant of people who have left. */
export function useDirectory(householdId: string | undefined) {
  const members = useAllMembers(householdId);
  const list: MemberWithLeft[] = members.data ?? [];
  const byMember = new Map(list.map((m) => [m.memberId, m]));
  const byUser = new Map(list.map((m) => [m.userId, m]));
  return {
    isPending: members.isPending,
    isError: members.isError,
    error: members.error,
    refetch: members.refetch,
    members: list,
    nameOf: (memberId: string | null | undefined) => (memberId ? (byMember.get(memberId)?.displayName ?? 'Former member') : 'Someone'),
    nameOfUser: (userId: string | null | undefined) => (userId ? (byUser.get(userId)?.displayName ?? 'Former member') : 'Someone'),
    member: (memberId: string) => byMember.get(memberId),
  };
}

/** Currency-aware formatter for the signed-in household. */
export function useMoney() {
  const access = useHouseholdAccess();
  const currency = access?.currencyCode ?? 'INR';
  return { currency, fmt: (minor: number) => formatMoney(minor, currency) };
}
