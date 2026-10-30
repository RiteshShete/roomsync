import { useEffect, useId, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

export interface MenuOption<V extends string> {
  value: V;
  label: string;
}

/**
 * A text button that opens a small menu of choices (the design's "Filter" and "Sort"). One option is
 * selected at a time. Escape or a tap outside closes it and focus goes back to the button.
 */
export function MenuButton<V extends string>({
  label,
  icon = 'filter',
  options,
  value,
  onChange,
}: {
  label: string;
  icon?: IconName;
  options: MenuOption<V>[];
  value: V;
  onChange: (v: V) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1 px-1 text-sm font-semibold text-coral"
      >
        {label}
        <Icon name={icon} size={16} />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-line bg-surface py-1 shadow-[0_6px_16px_rgba(61,61,61,0.14)]"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
                trigger.current?.focus();
              }}
              className={`flex min-h-11 w-full cursor-pointer items-center px-4 text-left text-sm text-ink-strong hover:bg-brand-soft ${o.value === value ? 'font-bold' : ''}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
