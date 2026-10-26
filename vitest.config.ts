import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { inlineLocalizationPlugin } from './scripts/i18n/inline-localization.mjs';

export default defineConfig({
  plugins: [inlineLocalizationPlugin(), react()],
  json: { stringify: true, namedExports: false },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
