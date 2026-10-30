import type { ReactNode } from 'react';

/**
 * Buttons side by side when they fit, stacked when they don't (large text, narrow screens), so a
 * row of actions never pushes the page wider than the screen.
 */
export function ButtonRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap gap-3 [&>*]:min-w-[8rem] [&>*]:flex-1 ${className}`}>{children}</div>;
}
