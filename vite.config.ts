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
      output: {
        // Split the large, rarely-changing vendors into their own long-cache chunks
        // so an app-code deploy does not re-download React/Supabase/etc. Content-pack
        // shards are emitted by contentPacksPlugin as separate assets (web only) and
        // are not JS modules, so this chunking never pulls them into the bundle.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const module = id.replace(/\\/g, '/');
          if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(module)) return 'vendor-react';
          if (module.includes('/node_modules/@tanstack/')) return 'vendor-query';
          if (module.includes('/node_modules/@supabase/')) return 'vendor-supabase';
          if (module.includes('/node_modules/framer-motion/') || module.includes('/node_modules/motion-dom/') || module.includes('/node_modules/motion-utils/')) return 'vendor-motion';
          if (module.includes('/node_modules/@radix-ui/')) return 'vendor-radix';
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
