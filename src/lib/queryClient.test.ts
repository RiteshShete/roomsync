import { onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { createQueryClient } from './queryClient';

afterEach(() => onlineManager.setOnline(true));

describe('createQueryClient: offline behaviour', () => {
  it('an action taken while offline fails right away instead of waiting silently', async () => {
    onlineManager.setOnline(false);
    const client = createQueryClient();
    const mutation = client.getMutationCache().build(client, {
      mutationFn: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await expect(mutation.execute(undefined)).rejects.toThrow('Failed to fetch');
    expect(mutation.state.status).toBe('error');
    expect(mutation.state.isPaused).toBe(false);
  });

  it('a load while offline is attempted too, so the screen can show an error with a retry', async () => {
    onlineManager.setOnline(false);
    const client = createQueryClient();
    let attempted = false;
    await client
      .fetchQuery({
        queryKey: ['offline-probe'],
        queryFn: () => {
          attempted = true;
          return Promise.reject(new TypeError('Failed to fetch'));
        },
        retry: false,
      })
      .catch(() => undefined);
    expect(attempted).toBe(true);
  });

  it('only transient network failures are retried, and at most twice', () => {
    const retry = createQueryClient().getDefaultOptions().queries!.retry as (n: number, e: unknown) => boolean;
    expect(retry(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(retry(2, new TypeError('Failed to fetch'))).toBe(false);
    expect(retry(0, { message: 'permission_denied' })).toBe(false);
  });
});
