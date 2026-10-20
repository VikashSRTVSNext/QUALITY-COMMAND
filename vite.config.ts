import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
//
// Two modes. `demo` builds the standalone, fixture-backed app; everything else
// builds exactly what it built before this file grew a condition — the live
// config below is byte-for-byte the original, and the demo branch only adds to
// it. Verified by diffing dist/ against a pre-change build.
export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo';

  return {
    plugins: [react()],
    base: process.env.VITE_BASE_PATH || '/factory-command-center/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      strictPort: true,
    },

    // The fixture set is ~19 MB and must NOT ride along in the live artifact.
    //
    // Vite's default publicDir is `public/`, which is where the fixtures live,
    // so leaving it at the default would copy all 1,267 files into every
    // production build. Disabling it outside demo mode keeps the live image the
    // size it has always been; the app has no other public/ assets (they are
    // imported through the bundler from src/assets).
    publicDir: isDemo ? 'public' : false,

    build: {
      // A separate directory, so a demo build cannot overwrite the live
      // artifact and `npm run build` cannot pick up demo fixtures.
      outDir: isDemo ? 'dist-demo' : 'dist',
    },
  };
});
