import { QueryClient } from '@tanstack/react-query';
import { SocketManager } from './SocketManager';
import { queryKeys } from '../../data/queries';
import type { LineMetric } from '../api/types';

// Bridges live WebSocket channels into the TanStack Query cache so components
// that read via useQuery(...) update in real time — no separate live-data path.
//
// Contract: the backend publishes on channels matching our query domains, e.g.
//   channel "production.lines" → payload: Partial<LineMetric> & { id: string }
//
// Returns a disposer that tears down subscriptions + the socket.
export function connectSocketBridge(qc: QueryClient, url: string): () => void {
  const socket = new SocketManager(url);
  const unsubscribers: Array<() => void> = [];

  // Live per-line updates merged into the production lines list cache.
  unsubscribers.push(
    socket.subscribe('production.lines', (payload) => {
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

  socket.connect();

  return () => {
    unsubscribers.forEach((u) => u());
    socket.disconnect();
  };
}
