import { resolve } from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import mdx from 'fumadocs-mdx/vite';
import { defineConfig } from 'vite';

import { readCurrentSiteConfig } from './scripts/lib/site-config.mjs';
import { buildSiteRouteIgnorePattern } from './scripts/lib/site-route-assembly.mjs';
import { docs, pages, posts } from './source.config';

const projectRoot = import.meta.dirname;
const currentSite = readCurrentSiteConfig({ rootDir: projectRoot });

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
        find: '@/site-home-server',
        replacement: resolve(projectRoot, '.generated/site-home.server.ts'),
      },
      {
        find: '@/site-home',
        replacement: resolve(projectRoot, '.generated/site-home.tsx'),
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
  build: {
    rollupOptions: {
      external: ['cloudflare:workers'],
    },
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
      client: {
        entry: '../../../.generated/entry.client.tsx',
      },
      server: {
        entry: '../../../.generated/entry.server.ts',
      },
      router: {
        routesDirectory: 'routes',
        generatedRouteTree: '../../../.generated/routeTree.gen.ts',
        routeFileIgnorePattern: buildSiteRouteIgnorePattern({
          rootDir: projectRoot,
          site: currentSite,
        }),
      },
    }),
    mdx({ docs, pages, posts }, { generateIndexFile: false }),
    react(),
  ],
});
