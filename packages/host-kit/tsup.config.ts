import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx', 'src/testing/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  external: ['react', 'react-dom', '@clerk/clerk-react', '@playwright/test'],
});
