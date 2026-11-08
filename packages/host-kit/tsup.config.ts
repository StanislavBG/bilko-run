import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx', 'src/testing/index.ts', 'src/vite/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  // dist/vite reads import.meta.url; this shims it in the CJS build.
  shims: true,
  external: ['react', 'react-dom', '@playwright/test'],
});
