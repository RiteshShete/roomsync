import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * WCAG AA for the colour tokens in src/index.css (light theme only). Reads the real CSS, so a token
 * change that breaks contrast fails here. Normal text needs 4.5:1; large or bold text and UI parts 3:1.
 */
const css = fs.readFileSync('src/index.css', 'utf8');
const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(root);
  if (!m) throw new Error(`token --${name} not found as a hex colour`);
  return m[1]!;
};

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(((n >> 16) & 255) / 255) + 0.7152 * channel(((n >> 8) & 255) / 255) + 0.0722 * channel((n & 255) / 255);
};
export const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

// [text token, background token, minimum ratio, where it is used]
const NORMAL = 4.5;
const LARGE = 3;
const PAIRS: [string, string, number, string][] = [
  ['ink', 'bg', NORMAL, 'body text on the page'],
  ['ink', 'surface', NORMAL, 'body text on cards'],
  ['ink-strong', 'surface', NORMAL, 'titles on cards'],
  ['ink', 'surface-tint', NORMAL, 'text on the peach banner'],
  ['ink', 'coral-strip', NORMAL, 'text on coral action strips'],
  ['ink', 'surface-sunken', NORMAL, 'text on grey chips'],
  ['ink-2', 'bg', NORMAL, 'secondary text on the page'],
  ['ink-2', 'surface', NORMAL, 'secondary text on cards'],
  ['ink-2', 'surface-sunken', NORMAL, 'disabled button labels and hints'],
  ['ink-2', 'surface-tint', NORMAL, 'secondary text on the banner'],
  ['on-primary', 'primary', NORMAL, 'labels on coral buttons'],
  ['on-primary', 'primary-pressed', NORMAL, 'labels on pressed coral buttons'],
  ['on-amber', 'amber', NORMAL, 'labels on amber buttons'],
  ['on-amber', 'amber-pressed', NORMAL, 'labels on pressed amber buttons'],
  ['coral-text', 'bg', NORMAL, 'coral links and labels on the page'],
  ['coral-text', 'surface', NORMAL, 'coral links and labels on cards'],
  ['coral-text', 'brand-soft', NORMAL, 'selected chips and rows'],
  ['coral-text', 'coral-strip', NORMAL, 'text buttons on action strips'],
  ['success-text', 'surface', NORMAL, 'green amounts on cards'],
  ['success-text', 'success-soft', NORMAL, 'green chips'],
  ['danger', 'surface', NORMAL, 'error text on cards'],
  ['danger', 'danger-soft', NORMAL, 'error chips'],
  ['warning', 'warning-soft', NORMAL, 'warning chips and banners'],
  ['info', 'info-soft', NORMAL, 'info chips'],
  ['success', 'surface', LARGE, 'big green amounts (20px bold or larger) on cards'],
  ['focus', 'bg', LARGE, 'focus ring on the page'],
  ['focus', 'surface', LARGE, 'focus ring on cards'],
];

describe('colour contrast (WCAG AA)', () => {
  it.each(PAIRS)('%s on %s is at least %s:1 (%s)', (fg, bg, min) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(min);
  });

  it('white on the danger colour (destructive buttons) is readable', () => {
    expect(ratio('#ffffff', token('danger'))).toBeGreaterThanOrEqual(NORMAL);
  });

  it('the helper agrees with known values', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(ratio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});
