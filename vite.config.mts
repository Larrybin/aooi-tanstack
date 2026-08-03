import { relative, resolve, sep } from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import mdx from 'fumadocs-mdx/vite';
import { defineConfig } from 'vite';

import { resolveSiteBuildPaths } from './scripts/lib/build-paths';
import { readCurrentSiteConfig } from './scripts/lib/site-config.ts';
import { buildSiteRouteIgnorePattern } from './scripts/lib/site-route-assembly.ts';
import { docs, pages, posts } from './source.config';

const projectRoot = import.meta.dirname;
const currentSite = readCurrentSiteConfig({ rootDir: projectRoot });
const { generatedDir, distDir } = resolveSiteBuildPaths({
  rootDir: projectRoot,
  siteKey: currentSite.key,
});
const appSourceDir = resolve(projectRoot, 'apps/web/src');
const fromAppSource = (targetPath: string) =>
  relative(appSourceDir, targetPath).split(sep).join('/');

export default defineConfig(({ command, isPreview }) => ({
  root: projectRoot,
  resolve: {
    alias: [
      {
        find: /^tailwindcss$/,
        replacement: resolve(projectRoot, 'node_modules/tailwindcss/index.css'),
      },
      {
        find: '@/site',
        replacement: resolve(generatedDir, 'site.ts'),
      },
      {
        find: '@/site-home-server',
        replacement: resolve(generatedDir, 'site-home.server.ts'),
      },
      {
        find: '@/site-home',
        replacement: resolve(generatedDir, 'site-home.tsx'),
      },
      {
        find: '@/content-source',
        replacement: resolve(generatedDir, 'content-source.ts'),
      },
      {
        find: '@/public-content',
        replacement: resolve(generatedDir, 'public-content.ts'),
      },
      {
        find: '@/route-tree',
        replacement: resolve(generatedDir, 'routeTree.gen.ts'),
      },
      {
        find: '@/paraglide',
        replacement: resolve(generatedDir, 'paraglide'),
      },
      { find: '@', replacement: resolve(projectRoot, 'src') },
    ],
  },
  build: {
    outDir: distDir,
    rollupOptions: {
      external: ['cloudflare:workers'],
    },
  },
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: resolve(generatedDir, 'paraglide'),
      strategy: ['globalVariable', 'baseLocale'],
      isServer: 'import.meta.env.SSR',
      emitGitIgnore: false,
      emitPrettierIgnore: false,
      emitReadme: false,
      emitTsDeclarations: true,
    }),
    cloudflare({
      ...(command === 'serve' && !isPreview
        ? {
            configPath: resolve(generatedDir, 'cloudflare/wrangler.app.toml'),
          }
        : {}),
      viteEnvironment: { name: 'ssr' },
    }),
    tanstackStart({
      srcDirectory: 'apps/web/src',
      client: {
        entry: fromAppSource(resolve(generatedDir, 'entry.client.tsx')),
      },
      server: {
        entry: fromAppSource(resolve(generatedDir, 'entry.server.ts')),
      },
      router: {
        routesDirectory: 'routes',
        generatedRouteTree: fromAppSource(
          resolve(generatedDir, 'routeTree.gen.ts')
        ),
        routeFileIgnorePattern: buildSiteRouteIgnorePattern({
          rootDir: projectRoot,
          site: currentSite,
        }),
      },
    }),
    mdx({ docs, pages, posts }, { generateIndexFile: false }),
    react(),
  ],
}));
