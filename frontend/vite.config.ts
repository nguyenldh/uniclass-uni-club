import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@uniclub/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    watch: {
      // Watch shared package changes → trigger HMR
      ignored: ['!**/shared/src/**'],
    },
  },
});
