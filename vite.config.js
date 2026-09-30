import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Arenduses suunab Vite kõik /api päringud Express'i serverisse.
// strictPort: kui port on hõivatud, anna viga, mitte ära vaheta vaikselt teise pordi peale.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': `http://localhost:${process.env.PORT || 3001}`,
    },
  },
});
