import { QueryClient } from '@tanstack/react-query';

// Single shared cache for all fetched + live data. The WebSocket bridge writes
// into this same client (see core/websocket/socketBridge.ts) so live ticks and
// polled data are one source of truth.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
