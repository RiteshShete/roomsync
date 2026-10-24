/** Initials avatar on the member's chosen colour. The text colour is picked for contrast. */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : '';
  return (first + last).toUpperCase();
}

function textOn(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const n = parseInt(m[1]!, 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return lum > 0.4 ? '#1b1b1b' : '#ffffff';
}

const SIZES = { sm: 'h-8 w-8 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-14 w-14 text-lg' } as const;

export function Avatar({
  name,
  color = '#4F46E5',
  size = 'md',
  ring = false,
}: {
  name: string;
  color?: string;
  size?: keyof typeof SIZES;
  /** White ring so overlapping avatars stay distinct. */
  ring?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={name}
      style={{ backgroundColor: color, color: textOn(color) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-extrabold ${SIZES[size]} ${ring ? 'ring-2 ring-surface' : ''}`}
    >
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  );
}

export function AvatarGroup({
  members,
  max = 4,
  size = 'sm',
}: {
  members: { name: string; color?: string }[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <span role="group" aria-label={`${members.length} members`} className="inline-flex items-center">
      {shown.map((m, i) => (
        <span key={`${m.name}-${i}`} className={i === 0 ? '' : '-ml-2'}>
          <Avatar name={m.name} color={m.color} size={size} ring />
        </span>
      ))}
      {extra > 0 ? (
        <span
          aria-label={`${extra} more`}
          role="img"
          className={`-ml-2 inline-flex items-center justify-center rounded-full bg-sunken font-extrabold text-ink ring-2 ring-surface ${SIZES[size]}`}
        >
          <span aria-hidden="true">+{extra}</span>
        </span>
      ) : null}
    </span>
  );
}
