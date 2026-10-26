/**
 * Runtime polyfills for older Android WebViews (Chrome 80-92 on Android 7-11).
 * Must be imported as the very first thing in main.tsx — before React, before
 * any vendor code from node_modules. Without these, the app white-screens on
 * Android 11 stock WebView (which ships Chrome 90 — no Object.hasOwn, etc.).
 */

// Object.hasOwn — added in Chrome 93 / Safari 15.4
if (typeof (Object as any).hasOwn !== 'function') {
  Object.defineProperty(Object, 'hasOwn', {
    value: function hasOwn(obj: unknown, prop: PropertyKey) {
      if (obj == null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }
      return Object.prototype.hasOwnProperty.call(Object(obj), prop);
    },
    configurable: true,
    writable: true,
  });
}

// Array.prototype.at — Chrome 92+ / Safari 15.4+
if (typeof (Array.prototype as any).at !== 'function') {
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Array.prototype, 'at', {
    value: function at(this: any[], n: number) {
      const len = this.length;
      const idx = n < 0 ? len + n : n;
      return idx < 0 || idx >= len ? undefined : this[idx];
    },
    configurable: true,
    writable: true,
  });
}

// String.prototype.at — Chrome 92+
if (typeof (String.prototype as any).at !== 'function') {
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(String.prototype, 'at', {
    value: function at(this: string, n: number) {
      const s = String(this);
      const len = s.length;
      const idx = n < 0 ? len + n : n;
      return idx < 0 || idx >= len ? undefined : s.charAt(idx);
    },
    configurable: true,
    writable: true,
  });
}

// crypto.randomUUID — Chrome 92+ / Safari 15.4+. App-level providers
// (AdExperienceProvider, ModeratorEnforcement) call it on the first render, so
// without it Android 11 WebView / iOS ≤15.3 crash the whole tree at startup.
const cryptoApi = (globalThis as any).crypto;
if (cryptoApi && typeof cryptoApi.randomUUID !== 'function' && typeof cryptoApi.getRandomValues === 'function') {
  Object.defineProperty(cryptoApi, 'randomUUID', {
    value: function randomUUID() {
      const b = cryptoApi.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40; // RFC 4122 v4
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, (x: number) => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    },
    configurable: true,
    writable: true,
  });
}

// structuredClone — Chrome 98+ / Safari 15.4+
if (typeof (globalThis as any).structuredClone !== 'function') {
  (globalThis as any).structuredClone = function structuredClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  };
}

export {};
