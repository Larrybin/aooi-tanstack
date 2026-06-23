import { resolve } from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const projectRoot = import.meta.dirname;

export default defineConfig({
  root: projectRoot,
  resolve: {
    alias: [
      {
        find: /^tailwindcss$/,
        replacement: resolve(projectRoot, 'node_modules/tailwindcss/index.css'),
      },
      {
        find: '@/site',
        replacement: resolve(projectRoot, '.generated/site.ts'),
      },
      {
        find: '@/content-source',
        replacement: resolve(projectRoot, '.generated/content-source.ts'),
      },
      {
        find: '@/public-content',
        replacement: resolve(projectRoot, '.generated/public-content.ts'),
      },
      { find: '@', replacement: resolve(projectRoot, 'src') },
    ],
  },
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['globalVariable', 'baseLocale'],
      isServer: 'import.meta.env.SSR',
      emitGitIgnore: false,
      emitPrettierIgnore: false,
      emitReadme: false,
      emitTsDeclarations: true,
    }),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart({
      srcDirectory: 'apps/web/src',
      router: {
        routesDirectory: 'routes',
        generatedRouteTree: 'routeTree.gen.ts',
      },
    }),
    react(),
  ],
});
