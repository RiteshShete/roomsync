import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/ui';

/** Page under a tab (e.g. You → Members): its own header with a back button to the parent tab. */
export function SubPage({ title, backTo = '/you', right, children }: { title: string; backTo?: string; right?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <>
      <Header title={title} onBack={() => navigate(backTo)} right={right} />
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </>
  );
}
