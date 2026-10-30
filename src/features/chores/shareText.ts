import type { Chore } from '@/api/chores';
import { copy } from '@/copy';
import { formatDay } from '@/lib/format';

/** A plain-text copy of a task list, for sharing: title, who has it, and when it is due. */
export function shareTasksText(title: string, tasks: Chore[], nameOf: (memberId: string | null) => string): string {
  const lines = tasks.map((c) => {
    const who = c.assigneeMemberId ? nameOf(c.assigneeMemberId) : copy.chores.unassigned;
    return `- ${c.title} (${who}${c.dueDate ? `, ${formatDay(c.dueDate)}` : ''})`;
  });
  return [title, ...lines].join('\n');
}
