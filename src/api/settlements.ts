import type { SettlementStatus } from '@/domain';
import { toAppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export interface Settlement {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  currencyCode: string;
  settlementDate: string;
  note: string | null;
  recordedBy: string;
  status: SettlementStatus;
  statusChangedBy: string | null;
  statusChangedAt: string | null;
  statusReason: string | null;
  createdAt: string;
  version: number;
}

export async function listSettlements(householdId: string): Promise<Settlement[]> {
  const { data, error } = await getSupabase()
    .from('settlements')
    .select(
      'id, from_member_id, to_member_id, amount_minor, currency_code, settlement_date, note, recorded_by, status, status_changed_by, status_changed_at, status_reason, created_at, version',
    )
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw toAppError(error);
  return data.map((r) => ({
    id: r.id,
    fromMemberId: r.from_member_id,
    toMemberId: r.to_member_id,
    amountMinor: r.amount_minor,
    currencyCode: r.currency_code,
    settlementDate: r.settlement_date,
    note: r.note,
    recordedBy: r.recorded_by,
    status: r.status as SettlementStatus,
    statusChangedBy: r.status_changed_by,
    statusChangedAt: r.status_changed_at,
    statusReason: r.status_reason,
    createdAt: r.created_at,
    version: r.version,
  }));
}

export async function recordSettlement(input: {
  householdId: string;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  settlementDate: string;
  note?: string | null;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc('record_settlement', {
    p_household_id: input.householdId,
    p_from_member_id: input.fromMemberId,
    p_to_member_id: input.toMemberId,
    p_amount_minor: input.amountMinor,
    p_settlement_date: input.settlementDate,
    p_note: input.note ?? undefined,
  });
  if (error) throw toAppError(error);
  return data;
}

export async function setSettlementStatus(settlementId: string, status: SettlementStatus, reason?: string, expectedVersion?: number): Promise<number> {
  const { data, error } = await getSupabase().rpc('set_settlement_status', {
    p_settlement_id: settlementId,
    p_status: status,
    p_reason: reason,
    p_expected_version: expectedVersion,
  });
  if (error) throw toAppError(error);
  return data;
}
