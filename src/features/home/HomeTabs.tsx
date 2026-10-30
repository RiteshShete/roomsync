import { copy } from '@/copy';

export type HomeTab = 'message' | 'activity';

/** The design's two tabs under the House Feed: Message and Activity. A dot (and hidden text) marks unread chat. */
export function HomeTabs({ tab, onChange, unreadChat }: { tab: HomeTab; onChange: (t: HomeTab) => void; unreadChat: boolean }) {
  const tabs: [HomeTab, string][] = [
    ['message', copy.chat.title],
    ['activity', copy.activity.recent],
  ];
  return (
    <div role="tablist" aria-label={copy.home.tabsLabel} className="flex gap-2">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={tab === key}
          onClick={() => onChange(key)}
          className={`relative -mb-px inline-flex min-h-11 cursor-pointer items-center border-b-2 px-3 text-base ${tab === key ? 'border-ink-strong font-bold text-ink-strong' : 'border-transparent text-ink'}`}
        >
          {label}
          {key === 'message' && unreadChat && tab !== 'message' ? (
            <>
              <span aria-hidden="true" className="absolute top-2 -right-0.5 h-2 w-2 rounded-full bg-primary" />
              <span className="sr-only"> — {copy.chat.newMessages}</span>
            </>
          ) : null}
        </button>
      ))}
    </div>
  );
}
