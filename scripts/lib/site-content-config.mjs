import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { resolveRequiredSiteKey, TEST_SITE_KEY } from './site-config.mjs';

export const CONTENT_COLLECTION_KEYS = Object.freeze([
  'docs',
  'pages',
  'posts',
]);
export const DEFAULT_DOCS_ENTRY = 'index.mdx';
export const FUMADOCS_CACHE_DIR = '.cache/fumadocs';

export function resolveSiteKeyForContent(env = process.env) {
  return env.SITE?.trim() || TEST_SITE_KEY;
}

export function resolveContentArtifactSiteKey(env = process.env) {
  return env.SITE?.trim() || TEST_SITE_KEY;
}

export function resolveSiteContentRoot({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  return path.resolve(rootDir, 'sites', siteKey, 'content');
}

export function resolveSiteCollectionDir({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
  collection,
}) {
  if (!CONTENT_COLLECTION_KEYS.includes(collection)) {
    throw new Error(
      `unknown content collection "${collection}"; expected one of ${CONTENT_COLLECTION_KEYS.join(', ')}`
    );
  }

  return path.resolve(resolveSiteContentRoot({ rootDir, siteKey }), collection);
}

export function resolveContentOutDir({
  rootDir = process.cwd(),
  siteKey = resolveContentArtifactSiteKey(),
  versionId,
} = {}) {
  const siteOutDir = path.resolve(rootDir, '.source', siteKey);
  if (!versionId) {
    return siteOutDir;
  }

  return path.resolve(siteOutDir, versionId);
}

export function resolveGeneratedContentSourcePath({
  rootDir = process.cwd(),
} = {}) {
  return path.resolve(rootDir, '.generated', 'content-source.ts');
}

export function resolveGeneratedPublicContentPath({
  rootDir = process.cwd(),
} = {}) {
  return path.resolve(rootDir, '.generated', 'public-content.ts');
}

export function resolveFumadocsCacheOutDir({
  rootDir = process.cwd(),
  siteKey = resolveContentArtifactSiteKey(),
} = {}) {
  return path.resolve(rootDir, FUMADOCS_CACHE_DIR, siteKey);
}

export function createContentArtifactVersionId() {
  return `build-${Date.now()}-${process.pid}`;
}

export function toContentSourceModuleSpecifier({ siteKey, versionId }) {
  if (!siteKey || !versionId) {
    throw new Error(
      'siteKey and versionId are required for content source module specifier'
    );
  }

  return `../.source/${siteKey}/${versionId}/index`;
}

export function parseContentSourceModuleSpecifier(source) {
  const match = source.match(
    /export \* from '\.\.\/\.source\/([^/]+)\/([^/]+)\/index';/
  );
  if (!match) {
    return null;
  }

  return {
    siteKey: match[1],
    versionId: match[2],
  };
}

export function assertSiteContentDirectoriesExist({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
  site,
} = {}) {
  const requiredCollections = ['pages'];

  if (!site || site.capabilities.docs) {
    requiredCollections.push('docs');
  }

  if (!site || site.capabilities.blog) {
    requiredCollections.push('posts');
  }

  for (const collection of requiredCollections) {
    const dirPath = resolveSiteCollectionDir({
      rootDir,
      siteKey,
      collection,
    });
    if (!existsSync(dirPath)) {
      throw new Error(
        `site content directory is required: sites/${siteKey}/content/${collection}`
      );
    }
  }
}

function listMdxFiles(dirPath) {
  if (!existsSync(dirPath)) {
    return [];
  }

  return readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => fileName.endsWith('.mdx'))
    .sort();
}

export function validateSiteContentCompleteness({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
  site,
}) {
  assertSiteContentDirectoriesExist({ rootDir, siteKey, site });

  const docsDir = resolveSiteCollectionDir({
    rootDir,
    siteKey,
    collection: 'docs',
  });
  const postsDir = resolveSiteCollectionDir({
    rootDir,
    siteKey,
    collection: 'posts',
  });

  const docsFiles = listMdxFiles(docsDir);
  const postFiles = listMdxFiles(postsDir);

  if (site.capabilities.docs && !docsFiles.includes(DEFAULT_DOCS_ENTRY)) {
    throw new Error(
      `site ${siteKey} enables docs, but sites/${siteKey}/content/docs/${DEFAULT_DOCS_ENTRY} is missing`
    );
  }

  if (site.capabilities.blog && postFiles.length === 0) {
    throw new Error(
      `site ${siteKey} enables blog, but sites/${siteKey}/content/posts must contain at least one .mdx file`
    );
  }
}
