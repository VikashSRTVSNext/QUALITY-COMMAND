import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../core/api/queryClient';
import { connectSocketBridge } from '../core/websocket/socketBridge';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Only wire the live socket bridge when a WS endpoint is configured.
    // With mocks (no backend), this stays off so there's no reconnect noise.
    const wsUrl = import.meta.env.VITE_WS_URL;
    if (!wsUrl) return;
    return connectSocketBridge(queryClient, wsUrl);
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export default AppProviders;
