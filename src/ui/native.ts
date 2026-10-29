import { Capacitor } from '@capacitor/core';

/**
 * True when running inside the Android/iOS app (a Capacitor shell around this same web build), false in
 * a browser. Native builds do not use the service worker (the files are inside the app) and cannot use
 * browser-style downloads or, reliably, the browser's speech API, so a few places check this.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
