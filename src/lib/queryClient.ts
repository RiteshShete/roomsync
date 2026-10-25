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
        retry: (failureCount, error) => failureCount < 2 && toAppError(error).code === 'network',
      },
      mutations: { retry: 0 },
    },
  });
}
