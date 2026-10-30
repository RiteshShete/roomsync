import { describe, expect, it } from 'vitest';
import { chore } from '@/test/home';
import { shareTasksText } from './shareText';

describe('shareTasksText', () => {
  it('lists each task with who has it and when it is due', () => {
    const text = shareTasksText('Tasks', [chore({ title: 'Dishes', dueDate: '2026-06-12' }), chore({ title: 'Bins', assigneeMemberId: null, dueDate: null })], () => 'Riya');
    expect(text).toBe('Tasks\n- Dishes (Riya, 12 Jun 2026)\n- Bins (Anyone can do this)');
  });
});
