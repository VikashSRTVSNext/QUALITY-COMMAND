import { QueryClient } from '@tanstack/react-query';
import { SseManager } from './SseManager';
import { queryKeys } from '../../data/queries';
import type { LineMetric } from '../api/types';

// Bridges live SSE channels into the TanStack Query cache so components
// that read via useQuery(...) update in real time — no separate live-data path.
//
// Returns a disposer that tears down subscriptions + the SSE connection.
export function connectSseBridge(qc: QueryClient, url: string): () => void {
  const sse = new SseManager(url);
  const unsubscribers: Array<() => void> = [];

  // Live per-line updates merged into the production lines list cache.
  unsubscribers.push(
    sse.subscribe('production.lines', (payload) => {
      const update = payload as Partial<LineMetric> & { id?: string };
      if (!update || typeof update.id !== 'string') return;
      qc.setQueryData<LineMetric[]>(queryKeys.productionLines, (prev) =>
        prev?.map((line) => (line.id === update.id ? { ...line, ...update } : line)),
      );
      // Also refresh an open drill-down for that line, if any.
      qc.setQueryData(queryKeys.lineDetail(update.id), (prev: any) =>
        prev ? { ...prev, ...update } : prev,
      );
    }),
  );

  sse.connect();

  return () => {
    unsubscribers.forEach((u) => u());
    sse.disconnect();
  };
}
