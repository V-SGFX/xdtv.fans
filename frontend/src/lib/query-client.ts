import { QueryClient, isServer } from '@tanstack/react-query';

/**
 * Shared query defaults for XDTV.
 *
 * The backend already caches feed responses in Redis (15s for logged-in users,
 * 30-120s otherwise), so the client staleTime is aligned with that rather than
 * set to 0 — refetching sooner only re-reads the same cached payload.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Matches the backend's Redis TTL band. Feed queries override this.
        staleTime: 60_000,
        gcTime: 5 * 60_000,

        // A content wall must not re-fetch and re-shuffle under the user when
        // they tab away and back. Explicit refresh only.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,

        // The API is a single origin we control; one retry is enough to ride
        // out a restart without hammering it during an outage.
        retry: 1,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * On the server every request must get its own client, otherwise one user's
 * cache leaks into another's response. In the browser we keep a singleton so
 * that a re-render (or a Fast Refresh) does not discard the cache.
 */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
