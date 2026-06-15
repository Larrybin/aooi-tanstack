
import { TaxonomyStatus } from '@/domains/content/domain/taxonomy-types';
import {
  addTaxonomyRow,
  updateTaxonomyRow,
} from '@/domains/content/infra/taxonomy-repo';

import type { taxonomy } from '@/config/db/schema';

export type NewTaxonomy = typeof taxonomy.$inferInsert;
export type UpdateTaxonomy = Partial<Omit<NewTaxonomy, 'id' | 'createdAt'>>;

export async function addTaxonomy(data: NewTaxonomy) {
  return await addTaxonomyRow(data);
}

export async function updateTaxonomy(id: string, data: UpdateTaxonomy) {
  return await updateTaxonomyRow(id, data);
}

export async function deleteTaxonomy(id: string) {
  const result = await updateTaxonomy(id, {
    status: TaxonomyStatus.ARCHIVED,
  });

  return result;
}
