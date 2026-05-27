import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
} from './site-config.mjs';

const pageTypes = [
  'seo',
  'blog',
  'docs',
  'legal',
  'product-ui',
  'auth',
  'admin',
];
const hashScopes = ['seo', 'content', 'ui'];
const sourceKinds = ['app-route', 'site-content', 'locale-messages'];
const manifestStatuses = ['pending', 'approved', 'rejected'];

const pageIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);

const cleanRelativePathSchema = z
  .string()
  .min(1)
  .refine((value) => !path.isAbsolute(value), {
    message: 'path must be relative',
  })
  .refine((value) => !value.split(/[\\/]/).includes('..'), {
    message: 'path must not contain .. segments',
  });

const pageSourceSchema = z
  .object({
    kind: z.enum(sourceKinds),
    path: cleanRelativePathSchema,
  })
  .strict();

export const siteI18nPageSchema = z
  .object({
    pageId: pageIdSchema,
    path: z.string().min(1).startsWith('/'),
    type: z.enum(pageTypes),
    indexable: z.boolean(),
    required: z.boolean(),
    source: pageSourceSchema,
    hashScope: z.enum(hashScopes),
  })
  .strict();

export const siteI18nPagesSchema = z
  .object({
    pages: z.array(siteI18nPageSchema).nonempty(),
  })
  .strict()
  .superRefine((registry, ctx) => {
    const seenPageIds = new Map();
    const seenPaths = new Map();

    registry.pages.forEach((page, index) => {
      const firstPageIdIndex = seenPageIds.get(page.pageId);
      if (firstPageIdIndex !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate pageId "${page.pageId}"`,
          path: ['pages', index, 'pageId'],
        });
      } else {
        seenPageIds.set(page.pageId, index);
      }

      const firstPathIndex = seenPaths.get(page.path);
      if (firstPathIndex !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate page path "${page.path}"`,
          path: ['pages', index, 'path'],
        });
      } else {
        seenPaths.set(page.path, index);
      }
    });
  });

const manifestPageSchema = z
  .object({
    path: z.string().min(1).startsWith('/'),
    status: z.enum(manifestStatuses),
    sourceHash: z.string().min(1),
    targetHash: z.string().min(1),
  })
  .strict();

export const siteI18nManifestSchema = z
  .object({
    locales: z.record(
      z.string().min(1),
      z.record(pageIdSchema, manifestPageSchema)
    ),
  })
  .strict();

export function resolveSiteI18nPagesPath({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  return path.resolve(rootDir, 'sites', siteKey, 'i18n', 'pages.json');
}

export function resolveSiteI18nManifestPath({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  return path.resolve(rootDir, 'sites', siteKey, 'i18n', 'manifest.json');
}

function readJsonFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`missing ${path.relative(process.cwd(), filePath)}`);
  }

  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function parseSiteI18nPages(input) {
  return siteI18nPagesSchema.parse(input);
}

export function parseSiteI18nManifest(input) {
  return siteI18nManifestSchema.parse(input);
}

function validateManifestLocales(manifest, site) {
  const expectedLocales = new Set(
    site.i18n.supportedLocales.filter(
      (locale) => locale !== site.i18n.defaultLocale
    )
  );
  const actualLocales = Object.keys(manifest.locales);

  if (actualLocales.includes(site.i18n.defaultLocale)) {
    throw new Error(
      `manifest must not include default locale "${site.i18n.defaultLocale}"`
    );
  }

  for (const locale of actualLocales) {
    if (!expectedLocales.has(locale)) {
      throw new Error(`manifest locale "${locale}" is not supported by site`);
    }
  }

  for (const locale of expectedLocales) {
    if (!Object.hasOwn(manifest.locales, locale)) {
      throw new Error(`manifest is missing locale "${locale}"`);
    }
  }
}

function validateManifestPages(manifest, pages) {
  const pagesById = new Map(pages.pages.map((page) => [page.pageId, page]));

  for (const [locale, entries] of Object.entries(manifest.locales)) {
    for (const [pageId, entry] of Object.entries(entries)) {
      const page = pagesById.get(pageId);
      if (!page) {
        throw new Error(
          `manifest locale "${locale}" references unknown page "${pageId}"`
        );
      }

      if (entry.path !== page.path) {
        throw new Error(
          `manifest locale "${locale}" page "${pageId}" path must equal "${page.path}"`
        );
      }
    }
  }
}

export function validateSiteI18nPackage({ pages, manifest, site }) {
  validateManifestLocales(manifest, site);
  validateManifestPages(manifest, pages);
}

export function readSiteI18nPages({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  return parseSiteI18nPages(
    readJsonFile(resolveSiteI18nPagesPath({ rootDir, siteKey }))
  );
}

export function readSiteI18nManifest({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  return parseSiteI18nManifest(
    readJsonFile(resolveSiteI18nManifestPath({ rootDir, siteKey }))
  );
}

export function readSiteI18nPackage({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  const site = readCurrentSiteConfig({ rootDir, siteKey });
  const pages = readSiteI18nPages({ rootDir, siteKey });
  const manifest = readSiteI18nManifest({ rootDir, siteKey });

  validateSiteI18nPackage({ pages, manifest, site });

  return { site, pages, manifest };
}
