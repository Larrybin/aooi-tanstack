import { resolve } from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const projectRoot = import.meta.dirname;
const serverOnlyEmptyModule = resolve(
  projectRoot,
  'node_modules/server-only/empty.js'
);

function serverOnlyForSsr(): Plugin {
  return {
    name: 'aooi-server-only-for-tanstack-ssr',
    enforce: 'pre',
    resolveId(id) {
      if (id !== 'server-only') {
        return null;
      }

      const environmentName = this.environment?.name;
      return environmentName === 'ssr' ? serverOnlyEmptyModule : null;
    },
  };
}

export default defineConfig({
  root: projectRoot,
  resolve: {
    alias: [
      {
        find: '@/site',
        replacement: resolve(projectRoot, '.generated/site.ts'),
      },
      {
        find: '@/content-source',
        replacement: resolve(projectRoot, '.generated/content-source.ts'),
      },
      { find: '@', replacement: resolve(projectRoot, 'src') },
    ],
  },
  plugins: [
    serverOnlyForSsr(),
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
