import type { Profile } from '@/api/profile';
import { copy } from '@/copy';

export const NAME_MAX = 60;

/** Avatar colours offered in the picker. Each is dark enough for the white initials the avatar draws on it. */
export const AVATAR_COLORS: { hex: string; name: string }[] = [
  { hex: '#E4573D', name: 'Coral' },
  { hex: '#C26A00', name: 'Amber' },
  { hex: '#0B8A63', name: 'Green' },
  { hex: '#2B7A9B', name: 'Teal' },
  { hex: '#4B3FB0', name: 'Indigo' },
  { hex: '#A23B72', name: 'Plum' },
  { hex: '#5F6672', name: 'Slate' },
];

export interface ProfileCheck {
  ok: boolean;
  /** Why Save is disabled; null when enabled. */
  reason: string | null;
  input: Profile | null;
}

/** Validates the profile form against what is saved, so an unchanged form can't be submitted. */
export function checkProfile(draft: Profile, saved: Profile): ProfileCheck {
  const input = { displayName: draft.displayName.trim(), avatarColor: draft.avatarColor };
  if (input.displayName === '') return { ok: false, reason: copy.profileEdit.reasonName, input: null };
  if (input.displayName.length > NAME_MAX) return { ok: false, reason: copy.profileEdit.reasonNameLong, input: null };
  if (input.displayName === saved.displayName && input.avatarColor.toLowerCase() === saved.avatarColor.toLowerCase()) {
    return { ok: false, reason: copy.profileEdit.reasonSame, input: null };
  }
  return { ok: true, reason: null, input };
}
