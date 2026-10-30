import { describe, expect, it } from 'vitest';
import { checkMessage, countUnread, MAX_MESSAGE } from './messageModel';

describe('checkMessage', () => {
  it('trims, and refuses empty or whitespace-only text with a reason', () => {
    expect(checkMessage('  hi  ')).toMatchObject({ ok: true, body: 'hi', reason: null });
    expect(checkMessage('   ').ok).toBe(false);
    expect(checkMessage('   ').reason).toBeTruthy();
  });
  it('allows exactly the limit and refuses one more', () => {
    expect(checkMessage('a'.repeat(MAX_MESSAGE)).ok).toBe(true);
    expect(checkMessage('a'.repeat(MAX_MESSAGE + 1)).ok).toBe(false);
  });
});

describe('countUnread', () => {
  const msgs = [
    { senderMemberId: 'me', createdAt: '2026-06-01T10:00:00Z' },
    { senderMemberId: 'x', createdAt: '2026-06-01T11:00:00Z' },
    { senderMemberId: 'y', createdAt: '2026-06-01T12:00:00Z' },
  ];
  it('counts only other people\'s messages after the last time it was seen', () => {
    expect(countUnread(msgs, 'me', null)).toBe(2);
    expect(countUnread(msgs, 'me', '2026-06-01T11:00:00Z')).toBe(1);
    expect(countUnread(msgs, 'me', '2026-06-01T13:00:00Z')).toBe(0);
  });
});
