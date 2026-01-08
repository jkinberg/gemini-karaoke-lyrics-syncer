import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    // Proxy API requests to the Express server during development
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
});
