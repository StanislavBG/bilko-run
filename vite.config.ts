import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
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
          // WebLLM ships ~2MB gzipped of runtime + wasm glue; only LocalScore uses it.
          // Split it off the main chunk so every other page loads faster.
          webllm: ['@mlc-ai/web-llm'],
          // Clerk is heavy and loads on every page; keep it in its own chunk for caching.
          clerk: ['@clerk/clerk-react'],
        },
      },
    },
  },
});
