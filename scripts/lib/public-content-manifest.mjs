import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  CONTENT_COLLECTION_KEYS,
  resolveSiteCollectionDir,
} from './site-content-config.mjs';

let registeredLocaleCodes;

const COLLECTION_BASE_PATHS = Object.freeze({
  docs: '/docs',
  pages: '/',
  posts: '/blog',
});

function walkFiles(dirPath, acc = []) {
  if (!existsSync(dirPath)) return acc;

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const abs = path.resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(abs, acc);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.mdx')) {
      acc.push(abs);
    }
  }

  return acc.sort();
}

function parseFrontmatter(source) {
  if (!source.startsWith('---\n')) {
    return { frontmatter: {}, content: source.trim() };
  }

  const endIndex = source.indexOf('\n---', 4);
  if (endIndex < 0) {
    return { frontmatter: {}, content: source.trim() };
  }

  const frontmatterSource = source.slice(4, endIndex).trim();
  const content = source.slice(endIndex + '\n---'.length).trim();
  const frontmatter = {};

  for (const line of frontmatterSource.split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    if (!key) continue;

    frontmatter[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }

  return { frontmatter, content };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readRegisteredLocaleCodes(rootDir) {
  if (registeredLocaleCodes) return registeredLocaleCodes;

  const registryPath = path.resolve(
    rootDir,
    'src',
    'config',
    'locale',
    'registry.json'
  );
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  registeredLocaleCodes = new Set(
    registry
      .map((entry) => entry?.code)
      .filter((code) => typeof code === 'string' && code.length > 0)
  );

  return registeredLocaleCodes;
}

function readLocalizedSlug({
  relPath,
  defaultLocale,
  locales,
  registeredLocales,
}) {
  const normalized = relPath.split(path.sep).join('/');
  const withoutExtension = normalized.replace(/\.mdx$/, '');
  const sortedLocales = [...locales].sort((a, b) => b.length - a.length);

  for (const locale of sortedLocales) {
    const suffix = `.${locale}`;
    if (withoutExtension.endsWith(suffix)) {
      return {
        locale,
        slug: normalizeSlug(withoutExtension.slice(0, -suffix.length)),
      };
    }
  }

  const supportedLocales = new Set(locales);
  const sortedRegisteredLocales = [...registeredLocales].sort(
    (a, b) => b.length - a.length
  );

  for (const locale of sortedRegisteredLocales) {
    if (supportedLocales.has(locale)) continue;

    const suffix = `.${locale}`;
    if (withoutExtension.endsWith(suffix)) {
      return null;
    }
  }

  return {
    locale: defaultLocale,
    slug: normalizeSlug(withoutExtension),
  };
}

function normalizeSlug(value) {
  return value.replace(/(^|\/)index$/, '').replace(/^\/+|\/+$/g, '');
}

function slugToPath(collection, slug) {
  const basePath = COLLECTION_BASE_PATHS[collection];
  if (!slug) return basePath;

  return `${basePath.replace(/\/$/, '')}/${slug}`;
}

function slugifyHeading(value, seen) {
  const base =
    value
      .toLowerCase()
      .trim()
      .replace(/`([^`]+)`/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section';

  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

function buildToc(content) {
  const seen = new Map();
  const toc = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const title = match[2].trim();
    toc.push({
      title,
      url: `#${slugifyHeading(title, seen)}`,
      depth: match[1].length,
    });
  }

  return toc;
}

function readCollectionDocuments({ rootDir, siteKey, site, collection }) {
  const dirPath = resolveSiteCollectionDir({ rootDir, siteKey, collection });
  const defaultLocale = site.i18n.defaultLocale;
  const locales = site.i18n.supportedLocales;
  const registeredLocales = readRegisteredLocaleCodes(rootDir);
  const documents = [];

  for (const filePath of walkFiles(dirPath)) {
    const relPath = path.relative(dirPath, filePath);
    const source = readFileSync(filePath, 'utf8');
    const { frontmatter, content } = parseFrontmatter(source);
    const localizedSlug = readLocalizedSlug({
      relPath,
      defaultLocale,
      locales,
      registeredLocales,
    });

    if (!localizedSlug) continue;

    const { locale, slug } = localizedSlug;
    documents.push({
      collection,
      locale,
      slug,
      path: slugToPath(collection, slug),
      sourcePath: path.relative(rootDir, filePath).split(path.sep).join('/'),
      title: frontmatter.title ?? '',
      description: frontmatter.description ?? '',
      created_at: frontmatter.created_at ?? '',
      author_name: frontmatter.author_name ?? '',
      author_image: frontmatter.author_image ?? '',
      image: frontmatter.image ?? '',
      content,
      toc: buildToc(content),
    });
  }

  return documents;
}

export function buildPublicContentDocuments({ rootDir, siteKey, site }) {
  return CONTENT_COLLECTION_KEYS.flatMap((collection) => {
    if (collection === 'docs' && !site.capabilities.docs) return [];
    if (collection === 'posts' && !site.capabilities.blog) return [];

    return readCollectionDocuments({ rootDir, siteKey, site, collection });
  }).sort((left, right) => {
    return `${left.collection}:${left.locale}:${left.slug}`.localeCompare(
      `${right.collection}:${right.locale}:${right.slug}`
    );
  });
}

export function toPublicContentManifestSource({
  documents,
  siteKey,
  versionId,
}) {
  return `export const publicContentSiteKey = ${JSON.stringify(siteKey)};
export const publicContentArtifactVersion = ${JSON.stringify(versionId)};

export type PublicContentCollection = 'docs' | 'pages' | 'posts';

export type PublicContentTocItem = {
  title: string;
  url: string;
  depth: number;
};

export type PublicContentDocument = {
  collection: PublicContentCollection;
  locale: string;
  slug: string;
  path: string;
  sourcePath: string;
  title: string;
  description: string;
  created_at: string;
  author_name: string;
  author_image: string;
  image: string;
  content: string;
  toc: PublicContentTocItem[];
};

export const publicContentDocuments: PublicContentDocument[] = ${JSON.stringify(documents, null, 2)};
`;
}

export function hasPublicContentRuntimeTaint(source) {
  return [
    /from ['"]react['"]/,
    /from ['"]fumadocs/,
    /from ['"]@\/mdx-components/,
    /docs\.css/,
    /body\s*:/,
    new RegExp(escapeRegex('ReactNode')),
  ].some((pattern) => pattern.test(source));
}
