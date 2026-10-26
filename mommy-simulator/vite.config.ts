import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5177, strictPort: true },
  preview: { host: '0.0.0.0', port: 4177, strictPort: true },
  css: { postcss: './postcss.config.js' },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          world: ['three'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
