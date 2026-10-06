import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Arenduses suunab Vite kõik /api päringud Express'i serverisse.
// Serveri port: keskkonnamuutuja PORT, selle puudumisel .env faili PORT (nagu serveris), muidu 3001.
// strictPort: kui port on hõivatud, anna viga, mitte ära vaheta vaikselt teise pordi peale.
export default defineConfig(({ mode }) => {
  const serverPort = process.env.PORT || loadEnv(mode, process.cwd(), '').PORT || 3001;
  return {
    plugins: [react()],
    server: {
      port: 5175,
      strictPort: true,
      proxy: {
        '/api': `http://localhost:${serverPort}`,
      },
    },
  };
});
