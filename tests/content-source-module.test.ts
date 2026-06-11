import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  cp,
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

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const generatedContentSourcePath = path.resolve(
  rootDir,
  '.generated/content-source.ts'
);
const generatedPublicContentPath = path.resolve(
  rootDir,
  '.generated/public-content.ts'
);

async function runGenerateContentSource(siteKey: string) {
  await execFileAsync(
    process.execPath,
    ['scripts/generate-content-source-module.mjs'],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        SITE: siteKey,
      },
    }
  );
}

async function readGeneratedContentSource() {
  return await readFile(generatedContentSourcePath, 'utf8');
}

async function readGeneratedPublicContent() {
  return await readFile(generatedPublicContentPath, 'utf8');
}

async function runTanStackValidate(siteKey: string) {
  await execFileAsync('pnpm', ['tanstack:validate'], {
    cwd: rootDir,
    env: {
      ...process.env,
      SITE: siteKey,
    },
  });
}

async function readGeneratedArtifactIndex(siteKey: string) {
  const pointer = parseGeneratedPointer(await readGeneratedContentSource());
  assert.equal(pointer.siteKey, siteKey);

  return await readFile(
    path.resolve(rootDir, '.source', siteKey, pointer.versionId, 'index.ts'),
    'utf8'
  );
}

function parseGeneratedPointer(source: string) {
  const match = source.match(/\.source\/([^/]+)\/([^/]+)\/index/);
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
  const pointer = parseGeneratedPointer(await readGeneratedContentSource());

  assert.equal(pointer.siteKey, 'dev-local');
  assert.match(pointer.versionId, /^build-\d+-\d+$/);
});

test('@/public-content: SITE=dev-local emits serializable public content manifest', async () => {
  await runGenerateContentSource('dev-local');

  const publicContentSource = await readGeneratedPublicContent();

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

  const publicContentSource = await readGeneratedPublicContent();

  assert.match(publicContentSource, /#8-性能next--tailwind--ts-交叉点/);
});

test('@/public-content: tanstack validation regenerates stale site manifest', async () => {
  await runGenerateContentSource('mamamiya');
  assert.match(
    await readGeneratedPublicContent(),
    /publicContentSiteKey = "mamamiya"/
  );

  await runTanStackValidate('dev-local');

  assert.match(
    await readGeneratedPublicContent(),
    /publicContentSiteKey = "dev-local"/
  );
});

test('@/content-source: SITE=mamamiya points to versioned .source/mamamiya artifact', async () => {
  await runGenerateContentSource('mamamiya');
  const pointer = parseGeneratedPointer(await readGeneratedContentSource());

  assert.equal(pointer.siteKey, 'mamamiya');
  assert.match(pointer.versionId, /^build-\d+-\d+$/);
});

test('@/public-content: SITE=mamamiya skips unsupported locale suffixes', async () => {
  await runGenerateContentSource('mamamiya');

  const publicContentSource = await readGeneratedPublicContent();

  assert.doesNotMatch(publicContentSource, /terms-of-service\.zh-TW/);
});

test('@/content-source: SITE=mamamiya includes grouped docs entrypoints', async () => {
  await runGenerateContentSource('mamamiya');

  const artifactIndex = await readGeneratedArtifactIndex('mamamiya');

  assert.match(artifactIndex, /docs\/quick-start\.mdx\?collection=docs/);
  assert.match(artifactIndex, /docs\/quick-start\.zh\.mdx\?collection=docs/);
  assert.match(artifactIndex, /docs\/customize\/index\.mdx\?collection=docs/);
  assert.match(
    artifactIndex,
    /docs\/customize\/app-info\.zh\.mdx\?collection=docs/
  );
  assert.match(
    artifactIndex,
    /docs\/deploy\/local-development\.mdx\?collection=docs/
  );
  assert.match(
    artifactIndex,
    /docs\/deploy\/cloudflare-deployment\.zh\.mdx\?collection=docs/
  );
  assert.match(artifactIndex, /docs\/core\/auth\.mdx\?collection=docs/);
  assert.match(artifactIndex, /docs\/core\/settings\.zh\.mdx\?collection=docs/);
  assert.match(
    artifactIndex,
    /docs\/extensions\/logging\.mdx\?collection=docs/
  );
  assert.match(
    artifactIndex,
    /docs\/extensions\/code-review-checklist\.zh\.mdx\?collection=docs/
  );
});

test('@/content-source: generation failure keeps previous pointer', async () => {
  await runGenerateContentSource('dev-local');
  const previous = await readGeneratedContentSource();

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

    const next = await readGeneratedContentSource();
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
  const backupDir = await mkdtemp(path.join(os.tmpdir(), 'content-backup-'));
  const siteConfigPath = path.resolve(
    rootDir,
    'sites/dev-local/site.config.json'
  );
  const docsDir = path.resolve(rootDir, 'sites/dev-local/content/docs');
  const postsDir = path.resolve(rootDir, 'sites/dev-local/content/posts');
  const originalSiteConfig = await readFile(siteConfigPath, 'utf8');

  try {
    await cp(docsDir, path.join(backupDir, 'docs'), { recursive: true });
    await cp(postsDir, path.join(backupDir, 'posts'), { recursive: true });

    const siteConfig = JSON.parse(originalSiteConfig);
    await writeFile(
      siteConfigPath,
      JSON.stringify(
        {
          ...siteConfig,
          capabilities: {
            ...siteConfig.capabilities,
            docs: false,
            blog: false,
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    await rm(docsDir, { recursive: true, force: true });
    await rm(postsDir, { recursive: true, force: true });

    await runGenerateContentSource('dev-local');

    const pointer = parseGeneratedPointer(await readGeneratedContentSource());
    assert.equal(pointer.siteKey, 'dev-local');
  } finally {
    await writeFile(siteConfigPath, originalSiteConfig, 'utf8');
    await rm(docsDir, { recursive: true, force: true });
    await rm(postsDir, { recursive: true, force: true });
    await cp(path.join(backupDir, 'docs'), docsDir, { recursive: true });
    await cp(path.join(backupDir, 'posts'), postsDir, { recursive: true });
    await rm(backupDir, { recursive: true, force: true });
    await runGenerateContentSource('dev-local');
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

test('@/content-source: page i18n includes Japanese legal pages', async () => {
  const source = await readFile(
    path.resolve(rootDir, 'src/domains/content/infra/source.ts'),
    'utf8'
  );

  assert.match(source, /languages:\s*\['en', 'zh', 'zh-TW', 'ja'\]/);
});

test('@/content-source: same-site publish keeps latest two versions and prunes older artifacts', async () => {
  await rm(path.resolve(rootDir, '.source/dev-local'), {
    recursive: true,
    force: true,
  });

  await runGenerateContentSource('dev-local');
  const first = parseGeneratedPointer(await readGeneratedContentSource());
  const firstVersions = await listArtifactVersions('dev-local');

  await new Promise((resolve) => setTimeout(resolve, 5));
  await runGenerateContentSource('dev-local');
  const second = parseGeneratedPointer(await readGeneratedContentSource());
  const secondVersions = await listArtifactVersions('dev-local');

  await new Promise((resolve) => setTimeout(resolve, 5));
  await runGenerateContentSource('dev-local');
  const third = parseGeneratedPointer(await readGeneratedContentSource());
  const thirdVersions = await listArtifactVersions('dev-local');

  assert.equal(first.siteKey, 'dev-local');
  assert.equal(second.siteKey, 'dev-local');
  assert.equal(third.siteKey, 'dev-local');
  assert.notEqual(second.versionId, first.versionId);
  assert.notEqual(third.versionId, second.versionId);

  assert.deepEqual(firstVersions, [first.versionId]);
  assert.deepEqual(secondVersions, [first.versionId, second.versionId].sort());
  assert.deepEqual(thirdVersions, [second.versionId, third.versionId].sort());
});

test('@/content-source: cross-site publish does not collapse previous site retention window', async () => {
  await rm(path.resolve(rootDir, '.source/dev-local'), {
    recursive: true,
    force: true,
  });
  await rm(path.resolve(rootDir, '.source/mamamiya'), {
    recursive: true,
    force: true,
  });

  await runGenerateContentSource('dev-local');
  const firstDevLocal = parseGeneratedPointer(
    await readGeneratedContentSource()
  );

  await new Promise((resolve) => setTimeout(resolve, 5));
  await runGenerateContentSource('dev-local');
  const secondDevLocal = parseGeneratedPointer(
    await readGeneratedContentSource()
  );

  await new Promise((resolve) => setTimeout(resolve, 5));
  await runGenerateContentSource('mamamiya');

  await new Promise((resolve) => setTimeout(resolve, 5));
  await runGenerateContentSource('dev-local');
  const thirdDevLocal = parseGeneratedPointer(
    await readGeneratedContentSource()
  );
  const devLocalVersions = await listArtifactVersions('dev-local');

  assert.equal(firstDevLocal.siteKey, 'dev-local');
  assert.equal(secondDevLocal.siteKey, 'dev-local');
  assert.equal(thirdDevLocal.siteKey, 'dev-local');
  assert.deepEqual(
    devLocalVersions,
    [secondDevLocal.versionId, thirdDevLocal.versionId].sort()
  );
});

test('@/content-source: site.config key mismatch fails fast', async () => {
  const siteConfigPath = path.resolve(
    rootDir,
    'sites/dev-local/site.config.json'
  );
  const original = await readFile(siteConfigPath, 'utf8');

  try {
    const broken = JSON.stringify(
      {
        ...JSON.parse(original),
        key: 'mamamiya',
      },
      null,
      2
    );
    await writeFile(siteConfigPath, `${broken}\n`, 'utf8');

    await assert.rejects(
      () => runGenerateContentSource('dev-local'),
      /site config key mismatch: expected "dev-local" but found "mamamiya"/
    );
  } finally {
    await writeFile(siteConfigPath, original, 'utf8');
    await runGenerateContentSource('dev-local');
  }
});
