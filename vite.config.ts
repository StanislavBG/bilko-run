import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Registry fields no src/ file reads (server + mcp-host-server read the full JSON from disk).
// Keeping them out of the client bundle avoids leaking the owner's local paths.
const REGISTRY_CLIENT_STRIP = ['sourceRepo', 'localPath'];

function slimStandaloneRegistry(): Plugin {
  return {
    name: 'slim-standalone-registry',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].endsWith('/src/data/standalone-projects.json')) return null;
      const entries = JSON.parse(code) as Record<string, unknown>[];
      for (const entry of entries) {
        const host = entry.host as Record<string, unknown> | undefined;
        for (const key of REGISTRY_CLIENT_STRIP) {
          delete entry[key];
          if (host) delete host[key];
        }
      }
      return JSON.stringify(entries);
    },
  };
}

export default defineConfig({
  define: {
    '__TEST_SEAMS__': JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  plugins: [react(), tailwindcss(), slimStandaloneRegistry()],
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // Clerk is heavy and loads on every page; keep it in its own chunk for caching.
          clerk: ['@clerk/clerk-react'],
        },
      },
    },
  },
});
