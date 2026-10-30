import { copyText } from './clipboard';

export type ShareResult = 'shared' | 'copied' | 'failed';

/** Opens the device's share sheet when there is one, otherwise copies the text. Never throws; a cancelled share is "shared". */
export async function shareText(title: string, text: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}
