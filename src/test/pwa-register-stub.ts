// Stands in for the `virtual:pwa-register` module (created by vite-plugin-pwa at build time) in tests.
// jsdom has no service worker, so registering does nothing.
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return async () => undefined;
}
