import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  define: {
    '__TEST_SEAMS__': JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  plugins: [react(), tailwindcss()],
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
