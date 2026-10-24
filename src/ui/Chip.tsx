import type { ReactNode } from 'react';

export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

const TONES: Record<ChipTone, string> = {
  neutral: 'bg-sunken text-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  brand: 'bg-brand-soft text-primary',
};

/**
 * Status/category chip. Meaning is always carried by the text (and optional icon), never by colour alone.
 */
export function Chip({ tone = 'neutral', icon, children }: { tone?: ChipTone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex min-h-6 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${TONES[tone]}`}>
      {icon}
      {children}
    </span>
  );
}
