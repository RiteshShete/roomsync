import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { sendMessage } from '@/api/chat';
import { copy } from '@/copy';
import { saveErrorMessage, errorMessage } from '@/lib/errors';
import { groupByDay } from '@/lib/dayGroups';
import { useDirectory } from '@/features/household/useDirectory';
import { useHouseholdAccess } from '@/features/household/useMembership';
import { Avatar, EmptyState, ErrorState, FormError, Icon, SkeletonList } from '@/ui';
import { useInvalidateChat, useMessages } from './hooks';
import { checkMessage } from './messageModel';

const time = (iso: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/**
 * Home → Message: the household's group chat, text only. Messages are kept for a short window (the
 * database prunes older ones), cannot be edited, and are readable only by people in the household.
 * A failed send never clears what was typed.
 */
export function ChatPanel({ tabs, markSeen }: { tabs: ReactNode; markSeen: () => void }) {
  const access = useHouseholdAccess();
  const dir = useDirectory(access?.householdId);
  const messages = useMessages(access?.householdId);
  const invalidate = useInvalidateChat();
  const [text, setText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const send = useMutation({
    mutationFn: (body: string) => sendMessage(access!.householdId, access!.memberId, body),
    onSuccess: async () => {
      setText('');
      setFormError(null);
      await invalidate();
    },
    onError: (err) => setFormError(saveErrorMessage(err)), // the text stays in the box
  });

  const count = messages.data?.length ?? 0;
  useEffect(() => {
    if (count > 0) {
      markSeen();
      end.current?.scrollIntoView?.({ block: 'end' });
    }
  }, [count, markSeen]);

  if (!access) return null;
  const check = checkMessage(text);
  const blocked = access.writeBlockedReason;
  const reason = blocked ?? (text.trim() === '' ? null : check.reason);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (send.isPending || blocked || !check.ok) return;
    send.mutate(check.body);
  }

  let body;
  if (messages.isPending || dir.isPending) body = <SkeletonList rows={4} />;
  else if (messages.isError) body = <ErrorState message={errorMessage(messages.error)} onRetry={() => void messages.refetch()} />;
  else if (count === 0) body = <EmptyState title={copy.chat.emptyTitle} body={copy.chat.emptyBody} />;
  else
    body = (
      <div aria-label={copy.chat.title} role="log" className="flex flex-col gap-4">
        {groupByDay(messages.data!).map((g) => (
          <section key={g.label} aria-label={g.label} className="flex flex-col gap-2">
            <h3 className="text-center text-xs font-bold tracking-wide text-ink2 uppercase">{g.label}</h3>
            <ul className="flex flex-col gap-2">
              {g.events.map((m) => {
                const mine = m.senderMemberId === access.memberId;
                const sender = dir.member(m.senderMemberId);
                const name = dir.nameOf(m.senderMemberId);
                return (
                  <li key={m.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                    {mine ? null : <Avatar name={name} color={sender?.avatarColor} size="sm" />}
                    <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine ? 'rounded-br-md bg-strip' : 'rounded-bl-md border border-line bg-surface'}`}>
                      <p className="text-xs font-bold text-ink-strong">{mine ? copy.balances.you : name}</p>
                      <p className="text-sm break-words whitespace-pre-wrap text-ink">{m.body}</p>
                      <p className="mt-0.5 text-right text-[11px] text-ink2">
                        <time dateTime={m.createdAt}>{time(m.createdAt)}</time>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <div ref={end} />
      </div>
    );

  return (
    <section aria-label={copy.chat.title} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-line">{tabs}</div>
      {body}
      <div className="h-24" aria-hidden="true" />
      <form
        onSubmit={onSubmit}
        noValidate
        className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md flex-col gap-1 border-t border-line bg-surface px-4 py-2"
      >
        <FormError message={formError} />
        <div className="flex items-center gap-2">
          <label htmlFor="chat-message" className="sr-only">
            {copy.chat.label}
          </label>
          <input
            id="chat-message"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={!!blocked}
            aria-describedby={reason ? 'chat-reason' : undefined}
            placeholder={copy.chat.placeholder}
            className="min-h-11 min-w-0 flex-1 rounded-full border border-field-line bg-field px-4 text-base text-ink placeholder:text-ink3/70"
          />
          <button
            type="submit"
            aria-label={copy.chat.send}
            aria-disabled={!check.ok || !!blocked || send.isPending || undefined}
            title={reason ?? copy.chat.send}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${!check.ok || blocked ? 'cursor-not-allowed bg-sunken text-ink2' : 'cursor-pointer bg-primary text-on-primary hover:bg-primary-pressed'}`}
          >
            <Icon name="send" size={20} />
          </button>
        </div>
        {reason ? (
          <p id="chat-reason" className="text-xs text-ink2">
            {reason}
          </p>
        ) : null}
      </form>
    </section>
  );
}
