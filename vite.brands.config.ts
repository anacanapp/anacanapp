import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Web-only /brands portal bundle. Deployed beside the live consumer build:
// hashed files go to /assets, the shell to /brands-app/index.html.
// Never used by native builds (the portal stays out of native bundles).
export default defineConfig({
  plugins: [react()],
  json: { stringify: true, namedExports: false },
  define: {
    // The portal must talk to the managed (Google) realm with its own session key.
    "import.meta.env.VITE_NATIVE_BUILD": JSON.stringify("false"),
  },
  build: {
    outDir: "dist-brands",
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: { input: path.resolve(__dirname, "brands-portal.html") },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
