
import type {
  TaxonomyStatus,
  TaxonomyType,
} from '@/domains/content/domain/taxonomy-types';
import {
  findTaxonomyRow,
  getTaxonomyRows,
  getTaxonomyRowsCount,
} from '@/domains/content/infra/taxonomy-repo';

import type { taxonomy } from '@/config/db/schema';

export type Taxonomy = typeof taxonomy.$inferSelect;

export async function findTaxonomy({
  id,
  slug,
  status,
}: {
  id?: string;
  slug?: string;
  status?: TaxonomyStatus;
}) {
  return await findTaxonomyRow({ id, slug, status });
}

export async function getTaxonomies({
  ids,
  type,
  status,
  page = 1,
  limit = 30,
}: {
  ids?: string[];
  type?: TaxonomyType;
  status?: TaxonomyStatus;
  page?: number;
  limit?: number;
} = {}): Promise<Taxonomy[]> {
  return await getTaxonomyRows({ ids, type, status, page, limit });
}

export async function getTaxonomiesCount({
  type,
  status,
}: {
  type?: TaxonomyType;
  status?: TaxonomyStatus;
} = {}): Promise<number> {
  return await getTaxonomyRowsCount({ type, status });
}
