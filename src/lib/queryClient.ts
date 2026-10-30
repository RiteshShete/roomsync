import { QueryClient } from '@tanstack/react-query';
import { toAppError } from './errors';

/** Retry only transient network failures, at most twice. Permission/validation errors never retry. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Don't hold on to unused data: nothing is kept around for long, in the browser or the database.
        gcTime: 60_000,
        refetchOnWindowFocus: true,
        // Offline, still try: the request fails at once and the screen shows a retryable error. The library's
        // default would pause it silently and leave a spinner (and run it later, unasked, when back online).
        networkMode: 'always',
        retry: (failureCount, error) => failureCount < 2 && toAppError(error).code === 'network',
      },
      // Same for saves: an action taken offline must fail visibly now, never fire by itself later.
      mutations: { retry: 0, networkMode: 'always' },
    },
  });
}
