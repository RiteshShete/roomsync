/** Pure domain types. Money is always integer minor units. Dates are ISO `YYYY-MM-DD` strings. */

export type MemberId = string;

export type SplitMethod = 'equal' | 'custom' | 'percentage';

export interface Share {
  memberId: MemberId;
  amountMinor: number;
}

export interface ExpenseRecord {
  id: string;
  amountMinor: number;
  paidBy: MemberId;
  shares: Share[];
  deleted?: boolean;
  title?: string;
}

export type SettlementStatus = 'recorded' | 'reversed' | 'disputed';

export interface SettlementRecord {
  id: string;
  from: MemberId;
  to: MemberId;
  amountMinor: number;
  status: SettlementStatus;
}

export type Balances = Record<MemberId, number>;

export interface Transfer {
  from: MemberId;
  to: MemberId;
  amountMinor: number;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
