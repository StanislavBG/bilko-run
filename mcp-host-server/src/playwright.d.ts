// Type shim so TypeScript accepts `import('playwright')` without playwright
// in this package's own node_modules. At runtime it resolves from the root's
// node_modules (parent-directory traversal). At compile time this stub suffices.
declare module 'playwright' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chromium: { launch(opts?: Record<string, unknown>): Promise<any> };
  export { chromium };
}
