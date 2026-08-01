import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { postInstall } from 'fumadocs-mdx/vite';

import {
  buildPublicContentDocuments,
  toPublicContentManifestSource,
} from './lib/public-content-manifest.ts';
import { readCurrentSiteConfig } from './lib/site-config.ts';
import {
  createContentArtifactVersionId,
  resolveContentArtifactSiteKey,
  resolveContentOutDir,
  resolveFumadocsCacheOutDir,
  resolveGeneratedContentSourcePath,
  resolveGeneratedPublicContentPath,
  toContentSourceModuleSpecifier,
  validateSiteContentCompleteness,
} from './lib/site-content-config.ts';

type GenerateContentOptions = {
  rootDir?: string;
  siteKey?: string;
};

function toModuleSource({
  rootDir,
  siteKey,
  versionId,
  generatedSourcePath,
}: {
  rootDir: string;
  siteKey: string;
  versionId: string;
  generatedSourcePath: string;
}): string {
  return `export * from '${toContentSourceModuleSpecifier({
    rootDir,
    siteKey,
    versionId,
    generatedSourcePath,
  })}';\n`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath, 'utf8');
    return true;
  } catch {
    return false;
  }
}

async function generateSiteContentArtifacts({
  rootDir = process.cwd(),
  siteKey = resolveContentArtifactSiteKey(),
}: GenerateContentOptions = {}): Promise<void> {
  const site = readCurrentSiteConfig({ rootDir, siteKey });
  validateSiteContentCompleteness({ rootDir, siteKey, site });

  const versionId = createContentArtifactVersionId();
  const targetOutDir = resolveContentOutDir({ rootDir, siteKey, versionId });
  const tempOutDir = `${targetOutDir}.tmp`;
  const generatedSourcePath = resolveGeneratedContentSourcePath({
    rootDir,
    siteKey,
  });
  const tempGeneratedSourcePath = `${generatedSourcePath}.tmp-${process.pid}-${Date.now()}`;
  const generatedPublicContentPath = resolveGeneratedPublicContentPath({
    rootDir,
    siteKey,
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

  const generatedSourceModulePath = path.resolve(
    tempOutDir,
    'source.generated.ts'
  );
  if (!(await fileExists(generatedSourceModulePath))) {
    throw new Error(
      `content artifact generation failed: missing ${generatedSourceModulePath}`
    );
  }

  await mkdir(path.dirname(generatedSourcePath), { recursive: true });
  await writeFile(
    tempGeneratedSourcePath,
    toModuleSource({ rootDir, siteKey, versionId, generatedSourcePath }),
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

  process.stdout.write(`[content] generated ${siteKey}:${versionId}\n`);
}

generateSiteContentArtifacts().catch((error) => {
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
