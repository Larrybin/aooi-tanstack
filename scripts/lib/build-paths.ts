import path from 'node:path';

type BuildPathOptions = {
  rootDir?: string;
  siteKey: string;
  env?: NodeJS.ProcessEnv;
};

export type SiteBuildPaths = {
  generatedDir: string;
  distDir: string;
  tsconfigPath: string;
};

export function resolveSiteBuildPaths({
  rootDir = process.cwd(),
  siteKey,
  env = process.env,
}: BuildPathOptions): SiteBuildPaths {
  const generatedDir = path.resolve(
    rootDir,
    env.AOOI_GENERATED_DIR?.trim() || path.join('.generated', 'sites', siteKey)
  );
  const distDir = path.resolve(
    rootDir,
    env.AOOI_DIST_DIR?.trim() || path.join('dist', siteKey)
  );

  return {
    generatedDir,
    distDir,
    tsconfigPath: path.join(generatedDir, 'tsconfig.json'),
  };
}

export function toPosixPath(value: string) {
  return value.split(path.sep).join('/');
}

export function toRelativeImport(fromPath: string, targetPath: string) {
  const relativePath = toPosixPath(
    path.relative(path.dirname(fromPath), targetPath)
  );
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}
