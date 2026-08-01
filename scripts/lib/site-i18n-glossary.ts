import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
} from './site-config.ts';

const nonEmptyStringSchema = z.string().min(1);

export const globalI18nGlossarySchema = z
  .object({
    preserve: z.array(nonEmptyStringSchema),
  })
  .strict();

export const siteI18nGlossarySchema = z
  .object({
    preserve: z.array(nonEmptyStringSchema),
    terms: z.record(
      nonEmptyStringSchema,
      z.record(nonEmptyStringSchema, nonEmptyStringSchema)
    ),
    forbidden: z.record(nonEmptyStringSchema, z.array(nonEmptyStringSchema)),
  })
  .strict();

export type GlobalI18nGlossary = z.infer<typeof globalI18nGlossarySchema>;
export type SiteI18nGlossary = z.infer<typeof siteI18nGlossarySchema>;
export type MergedI18nGlossary = SiteI18nGlossary;
type SiteLike = {
  i18n: { supportedLocales: string[] };
};

export function resolveGlobalI18nGlossaryPath(rootDir = process.cwd()) {
  return path.resolve(
    rootDir,
    'src',
    'config',
    'locale',
    'glossary.global.json'
  );
}

export function resolveSiteI18nGlossaryPath({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  return path.resolve(rootDir, 'sites', siteKey, 'i18n', 'glossary.json');
}

function readJsonFile(filePath: string): unknown {
  if (!existsSync(filePath)) {
    throw new Error(`missing ${path.relative(process.cwd(), filePath)}`);
  }

  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function parseGlobalI18nGlossary(input: unknown): GlobalI18nGlossary {
  return globalI18nGlossarySchema.parse(input);
}

export function parseSiteI18nGlossary(input: unknown): SiteI18nGlossary {
  return siteI18nGlossarySchema.parse(input);
}

function uniqueStrings(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function mergeI18nGlossaries(
  globalGlossary: GlobalI18nGlossary,
  siteGlossary: SiteI18nGlossary
): MergedI18nGlossary {
  return {
    preserve: uniqueStrings([
      ...globalGlossary.preserve,
      ...siteGlossary.preserve,
    ]),
    terms: siteGlossary.terms,
    forbidden: siteGlossary.forbidden,
  };
}

function validateSiteGlossaryLocales(
  siteGlossary: SiteI18nGlossary,
  site: SiteLike
) {
  const supportedLocales = new Set(site.i18n.supportedLocales);
  const allowedForbiddenKeys = new Set(['allLocales', ...supportedLocales]);

  for (const [term, translations] of Object.entries(siteGlossary.terms)) {
    for (const locale of Object.keys(translations)) {
      if (!supportedLocales.has(locale)) {
        throw new Error(
          `glossary term "${term}" uses unsupported locale "${locale}"`
        );
      }
    }
  }

  for (const locale of Object.keys(siteGlossary.forbidden)) {
    if (!allowedForbiddenKeys.has(locale)) {
      throw new Error(`glossary forbidden uses unsupported locale "${locale}"`);
    }
  }
}

export function readGlobalI18nGlossary({ rootDir = process.cwd() } = {}) {
  return parseGlobalI18nGlossary(
    readJsonFile(resolveGlobalI18nGlossaryPath(rootDir))
  );
}

export function readSiteI18nGlossary({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  const site = readCurrentSiteConfig({ rootDir, siteKey });
  const siteGlossary = parseSiteI18nGlossary(
    readJsonFile(resolveSiteI18nGlossaryPath({ rootDir, siteKey }))
  );

  validateSiteGlossaryLocales(siteGlossary, site);

  return siteGlossary;
}

export function readMergedI18nGlossary({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  return mergeI18nGlossaries(
    readGlobalI18nGlossary({ rootDir }),
    readSiteI18nGlossary({ rootDir, siteKey })
  );
}
