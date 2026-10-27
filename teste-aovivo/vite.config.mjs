import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
const aqui = path.dirname(new URL(import.meta.url).pathname);
export default defineConfig({
  root: aqui,
  publicDir: path.join(aqui, '../public'),
  plugins: [tailwindcss(), react()],
  resolve: { dedupe: ['react', 'react-dom'], alias: [
    { find: /^.*\/utils\/api$/, replacement: path.join(aqui, 'falsos/api.ts') },
    { find: /^.*\/hooks\/useRealtime$/, replacement: path.join(aqui, 'falsos/useRealtime.ts') },
    { find: /^.*\/ConfigContext$/, replacement: path.join(aqui, 'falsos/ConfigContext.ts') },
  ] },
  server: { port: 5191, strictPort: true, fs: { allow: [path.join(aqui, '..')] } },
});
