import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../core/api/queryClient';
import { connectSocketBridge } from '../core/websocket/socketBridge';
import { connectSseBridge } from '../core/sse/sseBridge';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Only wire the live socket/SSE bridge when endpoints are configured.
    // With mocks (no backend), this stays off so there's no reconnect noise.
    const wsUrl = import.meta.env.VITE_WS_URL;
    const sseUrl = import.meta.env.VITE_SSE_URL;
    const disposes: Array<() => void> = [];

    if (wsUrl) {
      disposes.push(connectSocketBridge(queryClient, wsUrl));
    }
    if (sseUrl) {
      disposes.push(connectSseBridge(queryClient, sseUrl));
    }

    return () => {
      disposes.forEach((dispose) => dispose());
    };
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export default AppProviders;
