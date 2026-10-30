import type { SVGProps } from 'react';
import logo from '@/assets/brand/logo.png';

/** Small stroke icon set (24px grid). Decorative by default: pair with a visible or aria-label text. */
const PATHS = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  wallet: 'M3 7a2 2 0 012-2h13v4M3 7v10a2 2 0 002 2h14V9H5a2 2 0 01-2-2zM16 14h2',
  checklist: 'M9 6h11M9 12h11M9 18h11M3.5 6.5l1.5 1.5 2.5-3M3.5 12.5L5 14l2.5-3M3.5 18.5L5 20l2.5-3',
  house: 'M4 20V9l8-5 8 5v11M9 20v-5h6v5M4 20h16',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4',
  pin: 'M12 17v5M8 3h8l-1 7 3 3H6l3-3-1-7z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  pen: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  chevron: 'M9 6l6 6-6 6',
  bell: 'M6 9a6 6 0 1112 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 004 0',
  back: 'M15 5l-7 7 7 7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3 3l18 18M10.6 6.2A9.8 9.8 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.7M6.6 7.6A17 17 0 002 12s4 7 10 7c1.5 0 2.8-.4 4-1M9.9 9.9a3 3 0 004.2 4.2',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 8v5M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  close: 'M6 6l12 12M18 6L6 18',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  filter: 'M3 5h18M6 12h12M10 19h4',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  cart: 'M3 4h2l2.4 11h10.2l2-8H6M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z',
  megaphone: 'M3 10v4h3l8 4V6L6 10H3zM18 9a4 4 0 010 6',
  send: 'M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z',
  chevronUp: 'M6 15l6-6 6 6',
  equal: 'M5 9h14M5 15h14',
  share: 'M12 16V4M7.5 8.5L12 4l4.5 4.5M5 13v6h14v-6',
  chevronDown: 'M6 9l6 6 6-6',
  sort: 'M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  leaf: 'M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19l8-8',
  swap: 'M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/**
 * The RoomSync logo from the design: the square artwork cropped inside a rounded box, exactly as the
 * design crops it (40 × 41 px at size 40). Decorative: the product name is always written next to it.
 */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="relative inline-block shrink-0 overflow-hidden" style={{ width: size, height: Math.round(size * 1.025), borderRadius: size * 0.225 }}>
      <img src={logo} alt="" className="absolute max-w-none" style={{ height: '155.56%', width: '159.09%', left: '-29.55%', top: '-23.33%' }} />
    </span>
  );
}
