import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { inlineLocalizationPlugin } from './scripts/i18n/inline-localization.mjs';
import { contentPacksPlugin } from './scripts/i18n/content-packs.mjs';
import { blogPrerenderPlugin } from './scripts/blog/prerender.mjs';
import { appEntryPlugin } from './scripts/app-entry/plugin.mjs';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [appEntryPlugin(), contentPacksPlugin(), inlineLocalizationPlugin(), react(), blogPrerenderPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  // Public locale catalogs are read as complete dictionaries. JSON.parse keeps
  // their thousands of entries out of Rollup's per-property AST/tree shaking.
  json: { stringify: true, namedExports: false },
  // Language dictionaries are lazy chunks inside the Word Garden module worker.
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      // @lovable.dev/cloud-auth-js is provided by Lovable Cloud at runtime
      // and is not available on npm for native/local builds
      external: ['@lovable.dev/cloud-auth-js'],
      // No manual vendor chunks. Splitting React and its dependents (Radix, framer-motion,
      // react-query) into separate vendor chunks created a chunk cycle, so a dependent
      // chunk evaluated before React and startup failed with "reading 'useLayoutEffect'"
      // (52.0.0 TestFlight + web, 2026-11-26). Rollup's default chunking is used; the
      // lazy Index/ModeratorEnforcement split in App.tsx stays. Guarded by
      // src/lib/startup-chunks.test.ts.
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
