
import { db } from '@/infra/adapters/db';
import { and, count, desc, eq, inArray } from 'drizzle-orm';

import { taxonomy } from '@/config/db/schema';

export type TaxonomyRow = typeof taxonomy.$inferSelect;
export type NewTaxonomyRow = typeof taxonomy.$inferInsert;
export type UpdateTaxonomyRow = Partial<
  Omit<NewTaxonomyRow, 'id' | 'createdAt'>
>;

export type TaxonomyQuery = {
  ids?: string[];
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export async function addTaxonomyRow(data: NewTaxonomyRow) {
  const [result] = await db().insert(taxonomy).values(data).returning();
  return result;
}

export async function updateTaxonomyRow(id: string, data: UpdateTaxonomyRow) {
  const [result] = await db()
    .update(taxonomy)
    .set(data)
    .where(eq(taxonomy.id, id))
    .returning();

  return result;
}

export async function findTaxonomyRow({
  id,
  slug,
  status,
}: {
  id?: string;
  slug?: string;
  status?: string;
}) {
  const [result] = await db()
    .select()
    .from(taxonomy)
    .where(
      and(
        id ? eq(taxonomy.id, id) : undefined,
        slug ? eq(taxonomy.slug, slug) : undefined,
        status ? eq(taxonomy.status, status) : undefined
      )
    )
    .limit(1);

  return result;
}

export async function getTaxonomyRows({
  ids,
  type,
  status,
  page = 1,
  limit = 30,
}: TaxonomyQuery = {}): Promise<TaxonomyRow[]> {
  const result = await db()
    .select()
    .from(taxonomy)
    .where(
      and(
        ids ? inArray(taxonomy.id, ids) : undefined,
        type ? eq(taxonomy.type, type) : undefined,
        status ? eq(taxonomy.status, status) : undefined
      )
    )
    .orderBy(desc(taxonomy.createdAt), desc(taxonomy.updatedAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return result;
}

export async function getTaxonomyRowsCount({
  type,
  status,
}: TaxonomyQuery = {}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(taxonomy)
    .where(
      and(
        type ? eq(taxonomy.type, type) : undefined,
        status ? eq(taxonomy.status, status) : undefined
      )
    )
    .limit(1);

  return result?.count || 0;
}
