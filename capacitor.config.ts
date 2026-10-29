import type { CapacitorConfig } from '@capacitor/cli';

// Native wrappers (Android, iOS) around the same web build that is published as the site.
// The app id identifies the app on the phone; it cannot change once an app is published to a store.
const config: CapacitorConfig = {
  appId: 'app.sproutcards.mobile',
  appName: 'SproutCards',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      // the app is always light, so the status bar icons must be dark whatever the phone's theme
      style: 'LIGHT',
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
