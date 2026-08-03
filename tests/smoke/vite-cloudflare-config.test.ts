import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const viteConfigSource = readFileSync('vite.config.mts', 'utf8');

test('Vite dev binds Cloudflare to the selected site app config without changing the build pipeline', () => {
  assert.match(
    viteConfigSource,
    /defineConfig\(\(\{ command, isPreview \}\) => \(\{/
  );
  assert.match(
    viteConfigSource,
    /command === 'serve' && !isPreview[\s\S]*?configPath:\s*resolve\(\s*generatedDir,\s*'cloudflare\/wrangler\.app\.toml'\s*\)/
  );
  assert.doesNotMatch(
    viteConfigSource,
    /command === 'build'[\s\S]*?configPath/
  );
});
