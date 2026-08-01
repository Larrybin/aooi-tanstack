import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { readCurrentSiteConfig } from '../scripts/lib/site-config.ts';
import { validateSiteContentCompleteness } from '../scripts/lib/site-content-config.ts';

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
function generatedDir(siteKey: string) {
  return path.resolve(rootDir, '.generated', 'sites', siteKey);
}

function generatedContentSourcePath(siteKey: string) {
  return path.resolve(generatedDir(siteKey), 'content-source.ts');
}

function generatedPublicContentPath(siteKey: string) {
  return path.resolve(generatedDir(siteKey), 'public-content.ts');
}

async function runGenerateContentSource(siteKey: string) {
  await execFileAsync(
    process.execPath,
    ['--import', 'tsx', 'scripts/generate-content-source-module.mts'],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        SITE: siteKey,
        AOOI_GENERATED_DIR: generatedDir(siteKey),
      },
    }
  );
}

async function readGeneratedContentSource(siteKey: string) {
  return await readFile(generatedContentSourcePath(siteKey), 'utf8');
}

async function readGeneratedPublicContent(siteKey: string) {
  return await readFile(generatedPublicContentPath(siteKey), 'utf8');
}

async function readGeneratedArtifactIndex(siteKey: string) {
  const pointer = parseGeneratedPointer(
    await readGeneratedContentSource(siteKey)
  );
  assert.equal(pointer.siteKey, siteKey);

  return await readFile(
    path.resolve(
      rootDir,
      '.source',
      siteKey,
      pointer.versionId,
      'source.generated.ts'
    ),
    'utf8'
  );
}

function parseGeneratedPointer(source: string) {
  const match = source.match(/\.source\/([^/]+)\/([^/]+)\/source\.generated/);
  assert.ok(match, `expected generated source pointer, got: ${source}`);

  return {
    siteKey: match[1],
    versionId: match[2],
  };
}

async function listArtifactVersions(siteKey: string) {
  const siteOutDir = path.resolve(rootDir, '.source', siteKey);

  try {
    const entries = await readdir(siteOutDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

test('@/content-source: SITE=dev-local points to versioned .source/dev-local artifact', async () => {
  await runGenerateContentSource('dev-local');
  const pointer = parseGeneratedPointer(
    await readGeneratedContentSource('dev-local')
  );

  assert.equal(pointer.siteKey, 'dev-local');
  assert.match(pointer.versionId, /^build-\d+-\d+$/);
});

test('@/public-content: SITE=dev-local emits serializable public content manifest', async () => {
  await runGenerateContentSource('dev-local');

  const publicContentSource = await readGeneratedPublicContent('dev-local');

  assert.match(publicContentSource, /collection": "pages"/);
  assert.match(publicContentSource, /publicContentSiteKey = "dev-local"/);
  assert.match(
    publicContentSource,
    /publicContentArtifactVersion = "build-\d+-\d+"/
  );
  assert.match(publicContentSource, /slug": "privacy-policy"/);
  assert.match(publicContentSource, /content":/);
  assert.doesNotMatch(publicContentSource, /from ['"]react['"]/);
  assert.doesNotMatch(publicContentSource, /from ['"]fumadocs/);
  assert.doesNotMatch(publicContentSource, /@\/mdx-components/);
  assert.doesNotMatch(publicContentSource, /docs\.css/);
});

test('@/public-content: manifest TOC heading ids match markdown renderer slugs', async () => {
  await runGenerateContentSource('dev-local');

  const publicContentSource = await readGeneratedPublicContent('dev-local');

  assert.match(publicContentSource, /#8-性能next--tailwind--ts-交叉点/);
  assert.match(
    publicContentSource,
    /"title": "Database",\n\s+"url": "#database"/
  );
  assert.doesNotMatch(publicContentSource, /"url": "#database-1"/);
  assert.doesNotMatch(publicContentSource, /"url": "#auth-secret"/);
  assert.doesNotMatch(publicContentSource, /"url": "#openssl-rand--base64-32"/);
});

test('@/public-content: tanstack validation regenerates stale site manifest', async () => {
  await runGenerateContentSource('mamamiya');
  assert.match(
    await readGeneratedPublicContent('mamamiya'),
    /publicContentSiteKey = "mamamiya"/
  );

  await runGenerateContentSource('dev-local');

  assert.match(
    await readGeneratedPublicContent('dev-local'),
    /publicContentSiteKey = "dev-local"/
  );
});

test('@/content-source: SITE=mamamiya points to versioned .source/mamamiya artifact', async () => {
  await runGenerateContentSource('mamamiya');
  const pointer = parseGeneratedPointer(
    await readGeneratedContentSource('mamamiya')
  );

  assert.equal(pointer.siteKey, 'mamamiya');
  assert.match(pointer.versionId, /^build-\d+-\d+$/);
});

test('@/public-content: SITE=mamamiya skips unsupported locale suffixes', async () => {
  await runGenerateContentSource('mamamiya');

  const publicContentSource = await readGeneratedPublicContent('mamamiya');

  assert.doesNotMatch(publicContentSource, /terms-of-service\.zh-TW/);
});

test('@/content-source: SITE=mamamiya emits native Vite collection entrypoints', async () => {
  await runGenerateContentSource('mamamiya');

  const artifactIndex = await readGeneratedArtifactIndex('mamamiya');

  assert.match(artifactIndex, /fumadocs-mdx\/runtime\/vite/);
  assert.match(artifactIndex, /collection["']?: ["']docs["']/);
  assert.match(artifactIndex, /sites\/mamamiya\/content\/docs/);
});

test('@/content-source: generation failure keeps previous pointer', async () => {
  await runGenerateContentSource('dev-local');
  const previous = await readGeneratedContentSource('dev-local');

  const docsIndexPath = path.resolve(
    rootDir,
    'sites/dev-local/content/docs/index.mdx'
  );
  const original = await readFile(docsIndexPath, 'utf8');

  try {
    await rm(docsIndexPath);

    await assert.rejects(
      () => runGenerateContentSource('dev-local'),
      /content\/docs\/index\.mdx is missing/
    );

    const next = await readGeneratedContentSource('dev-local');
    assert.equal(next, previous);
  } finally {
    await writeFile(docsIndexPath, original, 'utf8');
    await runGenerateContentSource('dev-local');
  }
});

test('@/content-source: blog-enabled site requires at least one post', async () => {
  const postPath = path.resolve(
    rootDir,
    'sites/dev-local/content/posts/what-is-xxx.mdx'
  );
  const zhPostPath = path.resolve(
    rootDir,
    'sites/dev-local/content/posts/what-is-xxx.zh.mdx'
  );
  const originalPost = await readFile(postPath, 'utf8');
  const originalZhPost = await readFile(zhPostPath, 'utf8');

  try {
    await rm(postPath);
    await rm(zhPostPath);

    await assert.rejects(
      () => runGenerateContentSource('dev-local'),
      /content\/posts must contain at least one \.mdx file/
    );
  } finally {
    await writeFile(postPath, originalPost, 'utf8');
    await writeFile(zhPostPath, originalZhPost, 'utf8');
    await runGenerateContentSource('dev-local');
  }
});

test('@/content-source: disabled docs/blog site may omit docs and posts directories', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'content-no-docs-'));
  const siteKey = 'no-docs';
  const pagesDir = path.resolve(tempRoot, `sites/${siteKey}/content/pages`);
  const site = JSON.parse(
    await readFile(
      path.resolve(rootDir, 'sites/dev-local/site.config.json'),
      'utf8'
    )
  );
  site.key = siteKey;
  site.capabilities.enabledModules = site.capabilities.enabledModules.filter(
    (moduleId: string) => moduleId !== 'docs' && moduleId !== 'blog'
  );
  try {
    await mkdir(pagesDir, { recursive: true });
    assert.doesNotThrow(() =>
      validateSiteContentCompleteness({
        rootDir: tempRoot,
        siteKey,
        site,
      })
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('@/content-source: pages directory remains required for every site', async () => {
  const backupDir = await mkdtemp(path.join(os.tmpdir(), 'content-backup-'));
  const pagesDir = path.resolve(rootDir, 'sites/dev-local/content/pages');

  try {
    await cp(pagesDir, path.join(backupDir, 'pages'), { recursive: true });
    await rm(pagesDir, { recursive: true, force: true });

    await assert.rejects(
      () => runGenerateContentSource('dev-local'),
      /site content directory is required: sites\/dev-local\/content\/pages/
    );
  } finally {
    await rm(pagesDir, { recursive: true, force: true });
    await cp(path.join(backupDir, 'pages'), pagesDir, { recursive: true });
    await rm(backupDir, { recursive: true, force: true });
    await runGenerateContentSource('dev-local');
  }
});

test('@/content-source: concurrent same-site publishes keep the selected artifact complete', async () => {
  await rm(path.resolve(rootDir, '.source/dev-local'), {
    recursive: true,
    force: true,
  });

  await Promise.all(
    Array.from({ length: 4 }, () => runGenerateContentSource('dev-local'))
  );

  const selected = parseGeneratedPointer(
    await readGeneratedContentSource('dev-local')
  );
  const versions = await listArtifactVersions('dev-local');

  assert.equal(selected.siteKey, 'dev-local');
  assert.ok(versions.includes(selected.versionId));
  assert.ok(versions.length >= 4);
  await readGeneratedArtifactIndex('dev-local');
});

test('@/content-source: concurrent cross-site publishes keep independent selected artifacts', async () => {
  await rm(path.resolve(rootDir, '.source/dev-local'), {
    recursive: true,
    force: true,
  });
  await rm(path.resolve(rootDir, '.source/mamamiya'), {
    recursive: true,
    force: true,
  });

  await Promise.all([
    runGenerateContentSource('dev-local'),
    runGenerateContentSource('mamamiya'),
  ]);

  const devLocal = parseGeneratedPointer(
    await readGeneratedContentSource('dev-local')
  );
  const mamamiya = parseGeneratedPointer(
    await readGeneratedContentSource('mamamiya')
  );

  assert.equal(devLocal.siteKey, 'dev-local');
  assert.equal(mamamiya.siteKey, 'mamamiya');
  assert.notEqual(devLocal.versionId, mamamiya.versionId);
  await readGeneratedArtifactIndex('dev-local');
  await readGeneratedArtifactIndex('mamamiya');
});

test('@/content-source: site.config key mismatch fails fast', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'site-key-mismatch-'));
  const siteDir = path.resolve(tempRoot, 'sites/dev-local');
  const original = await readFile(
    path.resolve(rootDir, 'sites/dev-local/site.config.json'),
    'utf8'
  );

  try {
    await mkdir(siteDir, { recursive: true });
    const broken = JSON.stringify(
      {
        ...JSON.parse(original),
        key: 'mamamiya',
      },
      null,
      2
    );
    await writeFile(
      path.resolve(siteDir, 'site.config.json'),
      `${broken}\n`,
      'utf8'
    );

    assert.throws(
      () =>
        readCurrentSiteConfig({
          rootDir: tempRoot,
          siteKey: 'dev-local',
        }),
      /site config key mismatch: expected "dev-local" but found "mamamiya"/
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
