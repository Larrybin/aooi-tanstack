import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { postInstall } from 'fumadocs-mdx/next';

import {
  buildPublicContentDocuments,
  toPublicContentManifestSource,
} from './lib/public-content-manifest.mjs';
import { readCurrentSiteConfig } from './lib/site-config.mjs';
import {
  createContentArtifactVersionId,
  resolveContentArtifactSiteKey,
  resolveContentOutDir,
  resolveFumadocsCacheOutDir,
  resolveGeneratedContentSourcePath,
  resolveGeneratedPublicContentPath,
  toContentSourceModuleSpecifier,
  validateSiteContentCompleteness,
} from './lib/site-content-config.mjs';

function toModuleSource({ siteKey, versionId }) {
  return `export * from '${toContentSourceModuleSpecifier({ siteKey, versionId })}';\n`;
}

async function fileExists(filePath) {
  try {
    await readFile(filePath, 'utf8');
    return true;
  } catch {
    return false;
  }
}

async function removeLegacyContentArtifacts({ rootDir }) {
  await Promise.all([
    rm(path.resolve(rootDir, '.source', 'index.ts'), { force: true }),
    rm(path.resolve(rootDir, '.source', 'source.config.mjs'), { force: true }),
    rm(path.resolve(rootDir, '.source', 'dev-local', 'index.ts'), {
      force: true,
    }),
    rm(path.resolve(rootDir, '.source', 'mamamiya', 'index.ts'), {
      force: true,
    }),
  ]);
}

function readVersionSortKey(versionId) {
  const match = versionId.match(/^build-(\d+)-(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    timestamp: Number.parseInt(match[1], 10),
    pid: Number.parseInt(match[2], 10),
  };
}

function compareVersionIds(left, right) {
  const leftKey = readVersionSortKey(left);
  const rightKey = readVersionSortKey(right);

  if (!leftKey || !rightKey) {
    return left.localeCompare(right);
  }

  if (leftKey.timestamp !== rightKey.timestamp) {
    return leftKey.timestamp - rightKey.timestamp;
  }

  return leftKey.pid - rightKey.pid;
}

async function pruneOlderSiteVersions({ rootDir, siteKey, keepCount = 2 }) {
  const siteOutDir = resolveContentOutDir({ rootDir, siteKey });
  await mkdir(siteOutDir, { recursive: true });

  const publishedVersionIds = (
    await readdir(siteOutDir, { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory() && !entry.name.endsWith('.tmp'))
    .map((entry) => entry.name)
    .sort(compareVersionIds);

  const versionIdsToRemove = publishedVersionIds.slice(
    0,
    Math.max(0, publishedVersionIds.length - keepCount)
  );

  await Promise.all(
    versionIdsToRemove.map((versionId) =>
      rm(path.resolve(siteOutDir, versionId), { recursive: true, force: true })
    )
  );
}

async function generateSiteContentArtifacts({
  rootDir = process.cwd(),
  siteKey = resolveContentArtifactSiteKey(),
} = {}) {
  const site = readCurrentSiteConfig({ rootDir, siteKey });
  validateSiteContentCompleteness({ rootDir, siteKey, site });

  const versionId = createContentArtifactVersionId();
  const targetOutDir = resolveContentOutDir({ rootDir, siteKey, versionId });
  const tempOutDir = `${targetOutDir}.tmp`;
  const generatedSourcePath = resolveGeneratedContentSourcePath({ rootDir });
  const tempGeneratedSourcePath = `${generatedSourcePath}.tmp-${process.pid}-${Date.now()}`;
  const generatedPublicContentPath = resolveGeneratedPublicContentPath({
    rootDir,
  });
  const tempGeneratedPublicContentPath = `${generatedPublicContentPath}.tmp-${process.pid}-${Date.now()}`;
  const fumadocsCacheOutDir = resolveFumadocsCacheOutDir({ rootDir, siteKey });
  const publicContentManifestSource = toPublicContentManifestSource({
    documents: buildPublicContentDocuments({ rootDir, siteKey, site }),
    siteKey,
    versionId,
  });

  await rm(tempOutDir, { recursive: true, force: true });
  await rm(targetOutDir, { recursive: true, force: true });
  await rm(fumadocsCacheOutDir, { recursive: true, force: true });

  await mkdir(path.dirname(tempOutDir), { recursive: true });
  await mkdir(path.dirname(fumadocsCacheOutDir), { recursive: true });

  await postInstall(
    path.resolve(rootDir, 'source.config.ts'),
    fumadocsCacheOutDir
  );
  await postInstall(path.resolve(rootDir, 'source.config.ts'), tempOutDir);

  const generatedIndexPath = path.resolve(tempOutDir, 'index.ts');
  if (!(await fileExists(generatedIndexPath))) {
    throw new Error(
      `content artifact generation failed: missing ${generatedIndexPath}`
    );
  }

  await mkdir(path.dirname(generatedSourcePath), { recursive: true });
  await writeFile(
    tempGeneratedSourcePath,
    toModuleSource({ siteKey, versionId }),
    'utf8'
  );
  await writeFile(
    tempGeneratedPublicContentPath,
    publicContentManifestSource,
    'utf8'
  );

  await rename(tempOutDir, targetOutDir);
  await rename(tempGeneratedSourcePath, generatedSourcePath);
  await rename(tempGeneratedPublicContentPath, generatedPublicContentPath);
  await removeLegacyContentArtifacts({ rootDir });

  await pruneOlderSiteVersions({
    rootDir,
    siteKey,
  });

  process.stdout.write(`[content] generated ${siteKey}:${versionId}\n`);
}

await generateSiteContentArtifacts();
