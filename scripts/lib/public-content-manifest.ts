import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import GithubSlugger from 'github-slugger';
import MarkdownIt from 'markdown-it';

import { hasSiteModule } from './site-capabilities.ts';
import {
  CONTENT_COLLECTION_KEYS,
  resolveSiteCollectionDir,
} from './site-content-config.ts';

type PublicContentCollection = 'docs' | 'pages' | 'posts';
type PublicContentTocItem = { title: string; url: string; depth: number };
type PublicContentDocument = {
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
type SiteLike = {
  i18n: { defaultLocale: string; supportedLocales: string[] };
  capabilities: { enabledModules: readonly string[] };
};

let registeredLocaleCodes: Set<string> | undefined;

const COLLECTION_BASE_PATHS: Readonly<Record<PublicContentCollection, string>> =
  Object.freeze({
    docs: '/docs',
    pages: '/',
    posts: '/blog',
  });
const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

function walkFiles(dirPath: string, acc: string[] = []) {
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

function parseFrontmatter(source: string) {
  if (!source.startsWith('---\n')) {
    return { frontmatter: {}, content: source.trim() };
  }

  const endIndex = source.indexOf('\n---', 4);
  if (endIndex < 0) {
    return { frontmatter: {}, content: source.trim() };
  }

  const frontmatterSource = source.slice(4, endIndex).trim();
  const content = source.slice(endIndex + '\n---'.length).trim();
  const frontmatter: Record<string, string> = {};

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

function readRegisteredLocaleCodes(rootDir: string) {
  if (registeredLocaleCodes) return registeredLocaleCodes;

  const registryPath = path.resolve(
    rootDir,
    'src',
    'config',
    'locale',
    'registry.json'
  );
  const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as Array<{
    code?: unknown;
  }>;
  registeredLocaleCodes = new Set(
    registry
      .map((entry) => entry?.code)
      .filter(
        (code): code is string => typeof code === 'string' && code.length > 0
      )
  );

  return registeredLocaleCodes;
}

function readLocalizedSlug({
  relPath,
  defaultLocale,
  locales,
  registeredLocales,
}: {
  relPath: string;
  defaultLocale: string;
  locales: string[];
  registeredLocales: Set<string>;
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

function normalizeSlug(value: string) {
  return value.replace(/(^|\/)index$/, '').replace(/^\/+|\/+$/g, '');
}

function slugToPath(collection: PublicContentCollection, slug: string) {
  const basePath = COLLECTION_BASE_PATHS[collection];
  if (!slug) return basePath;

  return `${basePath.replace(/\/$/, '')}/${slug}`;
}

function buildToc(content: string) {
  const toc: PublicContentTocItem[] = [];
  const slugger = new GithubSlugger();
  const tokens = markdown.parse(content, {});

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'heading_open') continue;

    const inlineToken = tokens[index + 1];
    if (!inlineToken || inlineToken.type !== 'inline') continue;

    const title = inlineToken.content.trim();
    if (!title) continue;

    toc.push({
      title,
      url: `#${slugger.slug(title)}`,
      depth: Number(token.tag.slice(1)),
    });
  }

  return toc;
}

export function readPublicContentDocumentTitle(
  frontmatter: Record<string, string>,
  toc: PublicContentTocItem[]
) {
  const frontmatterTitle =
    typeof frontmatter.title === 'string' ? frontmatter.title.trim() : '';
  if (frontmatterTitle) return frontmatterTitle;

  return toc.find((item) => item.depth === 1)?.title ?? '';
}

function readCollectionDocuments({
  rootDir,
  siteKey,
  site,
  collection,
}: {
  rootDir: string;
  siteKey: string;
  site: SiteLike;
  collection: PublicContentCollection;
}) {
  const dirPath = resolveSiteCollectionDir({ rootDir, siteKey, collection });
  const defaultLocale = site.i18n.defaultLocale;
  const locales = site.i18n.supportedLocales;
  const registeredLocales = readRegisteredLocaleCodes(rootDir);
  const documents: PublicContentDocument[] = [];

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
    const toc = buildToc(content);

    documents.push({
      collection,
      locale,
      slug,
      path: slugToPath(collection, slug),
      sourcePath: path.relative(rootDir, filePath).split(path.sep).join('/'),
      title: readPublicContentDocumentTitle(frontmatter, toc),
      description: frontmatter.description ?? '',
      created_at: frontmatter.created_at ?? '',
      author_name: frontmatter.author_name ?? '',
      author_image: frontmatter.author_image ?? '',
      image: frontmatter.image ?? '',
      content,
      toc,
    });
  }

  return documents;
}

export function buildPublicContentDocuments({
  rootDir,
  siteKey,
  site,
}: {
  rootDir: string;
  siteKey: string;
  site: SiteLike;
}) {
  return (CONTENT_COLLECTION_KEYS as readonly PublicContentCollection[])
    .flatMap((collection) => {
      if (collection === 'docs' && !hasSiteModule(site, 'docs')) return [];
      if (collection === 'posts' && !hasSiteModule(site, 'blog')) return [];

      return readCollectionDocuments({ rootDir, siteKey, site, collection });
    })
    .sort((left, right) => {
      return `${left.collection}:${left.locale}:${left.slug}`.localeCompare(
        `${right.collection}:${right.locale}:${right.slug}`
      );
    });
}

export function toPublicContentManifestSource({
  documents,
  siteKey,
  versionId,
}: {
  documents: PublicContentDocument[];
  siteKey: string;
  versionId: string;
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hasPublicContentRuntimeTaint(source: string) {
  return [
    /from ['"]react['"]/,
    /from ['"]fumadocs/,
    /from ['"]@\/mdx-components/,
    /docs\.css/,
    /body\s*:/,
    new RegExp(escapeRegex('ReactNode')),
  ].some((pattern) => pattern.test(source));
}
