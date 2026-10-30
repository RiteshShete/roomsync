import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareText } from './share';

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
});

describe('shareText', () => {
  it('uses the share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    expect(await shareText('T', 'body')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'T', text: 'body' });
  });
  it('a cancelled share is not an error', async () => {
    Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')), configurable: true });
    expect(await shareText('T', 'body')).toBe('shared');
  });
  it('copies when there is no share sheet, and says when that fails too', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await shareText('T', 'body')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('body');
    writeText.mockRejectedValue(new Error('no'));
    document.execCommand = vi.fn().mockReturnValue(false);
    expect(await shareText('T', 'body')).toBe('failed');
  });
});
