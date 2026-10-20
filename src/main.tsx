import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './app/providers';
import { router } from './app/router';
import './index.css';

const mount = () =>
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </React.StrictMode>
  );

// Standalone demo mode.
//
// Vite replaces import.meta.env.VITE_DATA_MODE with a string literal at build
// time, so in the live build this collapses to `if ('' === 'demo')` and both the
// branch and the dynamic import are dropped — nothing under src/demo reaches the
// production bundle. Verified by grepping dist/ for the demo chunk.
//
// The transport must be installed BEFORE React mounts: the dashboard opens its
// three EventSources and fires its first fetches in mount effects, and a shim
// installed after that would miss them.
if (import.meta.env.VITE_DATA_MODE === 'demo') {
  void (async () => {
    const { bootstrapDemo } = await import('./demo/installDemoTransport');
    await bootstrapDemo();
    mount();
  })();
} else {
  mount();
}
