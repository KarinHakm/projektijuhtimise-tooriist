import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

// Kompileerib ühe JSX-komponendi Vite'iga ajutisse kausta ja impordib selle,
// et testid saaksid seda react-dom/server abil võltsandmetega renderdada (ilma brauserita).
// Ajutine kaust on node_modules/.cache all (git'ist ignoreeritud), et import leiaks paketi "react".
export async function importJsx(relativePath) {
  const cacheDir = resolve('node_modules', '.cache');
  mkdirSync(cacheDir, { recursive: true });
  const outDir = mkdtempSync(join(cacheDir, 'pjt-jsx-'));
  try {
    await build({
      configFile: false,
      root: resolve('.'),
      logLevel: 'silent',
      plugins: [react()],
      build: { ssr: resolve(relativePath), outDir, emptyOutDir: true, write: true },
    });
    const file = relativePath.split('/').at(-1).replace(/\.jsx$/, '.js');
    return await import(pathToFileURL(join(outDir, file)).href);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}
