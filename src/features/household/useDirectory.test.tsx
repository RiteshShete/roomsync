import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as households from '@/api/households';
import { aarav, riya } from '@/test/render';
import { useDirectory, useFreshDirectory } from './useDirectory';

vi.mock('@/api/households');

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const asAll = (m: typeof aarav[]) => m as households.MemberWithLeft[];

beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
});

describe('useDirectory', () => {
  it('names members by member id and by user id, and tolerates people it does not know', async () => {
    vi.mocked(households.listAllMembers).mockResolvedValue(asAll([aarav, riya]));
    const { result } = renderHook(() => useDirectory('h1'), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.nameOf('m-riya')).toBe('Riya');
    expect(result.current.nameOfUser('u-riya')).toBe('Riya');
    expect(result.current.nameOf('m-gone')).toBe('Former member');
    expect(result.current.nameOf(null)).toBe('Someone');
  });
});

describe('useFreshDirectory', () => {
  it('does not hand a form a stale cached member list: it waits for the fresh one', async () => {
    client.setQueryData(['members-all', 'h1'], asAll([aarav])); // cached when only one person lived here
    vi.mocked(households.listAllMembers).mockResolvedValue(asAll([aarav, riya])); // someone joined since
    const { result } = renderHook(() => useFreshDirectory('h1'), { wrapper });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.members.map((m) => m.memberId)).toEqual(['m-aarav', 'm-riya']);
  });

  it('once ready it stays ready, so a later background refresh never remounts an open form', async () => {
    vi.mocked(households.listAllMembers).mockResolvedValue(asAll([aarav]));
    const { result } = renderHook(() => useFreshDirectory('h1'), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    let release!: () => void;
    vi.mocked(households.listAllMembers).mockReturnValue(new Promise((resolve) => (release = () => resolve(asAll([aarav, riya])))));
    void client.invalidateQueries({ queryKey: ['members-all'] });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.isPending).toBe(false);
    release();
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.isPending).toBe(false);
  });

  it('surfaces a failed load instead of waiting forever', async () => {
    vi.mocked(households.listAllMembers).mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useFreshDirectory('h1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});
