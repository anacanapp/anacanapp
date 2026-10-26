import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5188, strictPort: true },
  preview: { host: '0.0.0.0', port: 4188, strictPort: true },
  build: { target: 'es2020', sourcemap: false },
});
