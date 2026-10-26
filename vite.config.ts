/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative paths: the built site works from any folder or sub-path of a static host.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // single-page app: any navigation falls back to the cached index.html when offline
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // catalog index and deck files: fresh when online, last copy when offline
            urlPattern: ({ url }) => url.pathname.includes('/catalog/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'catalog' },
          },
        ],
      },
      manifest: {
        name: 'SproutCards',
        short_name: 'SproutCards',
        description: 'Flashcards for learning any language, offline.',
        theme_color: '#58a83c',
        background_color: '#ffffff',
        display: 'standalone',
        id: './',
        start_url: './',
        scope: './',
        categories: ['education'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    // `virtual:pwa-register` only exists in real builds; tests use a stub
    alias: {
      'virtual:pwa-register': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url),
      ),
    },
    testTimeout: 20000, // UI tests play whole study sessions
    setupFiles: ['./src/test/setup.ts'],
  },
});
