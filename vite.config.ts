import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

const GH_PAGES_BASE = '/Print-Kampus/';

export default defineConfig(() => {
  return {
    base: GH_PAGES_BASE,
    plugins: [
      react(),
      tailwindcss(),
      // Allow local Vite dev server to accept root paths (/, /user, /mitra, /admin)
      // transparently while keeping base: '/Print-Kampus/' for GitHub Pages builds.
      {
        name: 'dev-root-rewrite-for-gh-pages-base',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            const rawUrl = req.url || '/';
            const [pathname, query] = rawUrl.split('?');
            if (
              !pathname.startsWith(GH_PAGES_BASE) &&
              !pathname.startsWith('/@') &&
              !pathname.startsWith('/node_modules') &&
              !pathname.startsWith('/src/') &&
              !pathname.includes('.')
            ) {
              const suffix = pathname === '/' ? '' : pathname.replace(/^\//, '');
              req.url = `${GH_PAGES_BASE}${suffix}${query ? `?${query}` : ''}`;
            }
            next();
          });
        },
      },
      // Copies src/assets into dist/ and creates dist/404.html for GitHub Pages SPA routing.
      {
        name: 'copy-unbundled-src-assets-and-spa-404',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
          const indexHtml = path.join(distDir, 'index.html');
          const notFoundHtml = path.join(distDir, '404.html');
          if (fs.existsSync(indexHtml)) {
            fs.copyFileSync(indexHtml, notFoundHtml);
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
