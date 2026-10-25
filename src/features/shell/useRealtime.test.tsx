import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeToHousehold, type RealtimeStatus } from '@/api/realtime';
import { useRealtime } from './useRealtime';

vi.mock('@/api/realtime', () => ({ subscribeToHousehold: vi.fn() }));

let onChange: () => void;
let onStatus: (s: RealtimeStatus) => void;
const unsubscribe = vi.fn();
let client: QueryClient;
let invalidate: ReturnType<typeof vi.spyOn>;

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  client = new QueryClient();
  invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
  vi.mocked(subscribeToHousehold).mockImplementation((_id, change, status) => {
    onChange = change;
    onStatus = status;
    return unsubscribe;
  });
});

afterEach(() => vi.useRealTimers());

describe('useRealtime', () => {
  it('does nothing without a household', () => {
    renderHook(() => useRealtime(undefined), { wrapper });
    expect(subscribeToHousehold).not.toHaveBeenCalled();
  });

  it('a change refreshes the queries once (debounced) and flashes "updated", then clears', () => {
    const { result } = renderHook(() => useRealtime('h1'), { wrapper });
    act(() => {
      onChange();
      onChange();
      onChange();
    });
    expect(invalidate).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(300));
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(result.current.justUpdated).toBe(true);
    act(() => void vi.advanceTimersByTime(2500));
    expect(result.current.justUpdated).toBe(false);
  });

  it('reports the channel status and does not poll while it is live', () => {
    const { result } = renderHook(() => useRealtime('h1'), { wrapper });
    act(() => onStatus('live'));
    expect(result.current.status).toBe('live');
    act(() => void vi.advanceTimersByTime(120_000));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('falls back to polling every 30 seconds when the channel is down, and stops when it recovers', () => {
    const { result } = renderHook(() => useRealtime('h1'), { wrapper });
    act(() => onStatus('down'));
    expect(result.current.status).toBe('down');
    act(() => void vi.advanceTimersByTime(30_000));
    expect(invalidate).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(30_000));
    expect(invalidate).toHaveBeenCalledTimes(2);
    act(() => onStatus('live'));
    act(() => void vi.advanceTimersByTime(90_000));
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('if the channel cannot even be created, it polls instead of breaking the app', () => {
    vi.mocked(subscribeToHousehold).mockImplementation(() => {
      throw new Error('no client');
    });
    const { result } = renderHook(() => useRealtime('h1'), { wrapper });
    expect(result.current.status).toBe('down');
    act(() => void vi.advanceTimersByTime(30_000));
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount and when the household changes', () => {
    const { rerender, unmount } = renderHook(({ id }) => useRealtime(id), { wrapper, initialProps: { id: 'h1' } });
    rerender({ id: 'h2' });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribeToHousehold).toHaveBeenLastCalledWith('h2', expect.any(Function), expect.any(Function));
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });
});
