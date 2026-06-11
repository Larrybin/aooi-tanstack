'use server';

import {
  addTaxonomy,
  updateTaxonomy,
  type NewTaxonomy,
} from '@/domains/content/application/taxonomy-management';
import { findTaxonomy } from '@/domains/content/application/taxonomy.query';
import {
  TaxonomyStatus,
  TaxonomyType,
} from '@/domains/content/domain/taxonomy-types';
import { AdminCategoryFormSchema } from '@/surfaces/admin/schemas/category';
import { validateAndParseForm } from '@/app/_admin-support/action-utils';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { ActionError } from '@/shared/lib/action/errors';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { getUuid } from '@/shared/lib/hash';

/**
 * Create a new category
 */
export async function createCategoryAction(formData: FormData) {
  return withAction(async () => {
    const { user, data } = await validateAndParseForm({
      formData,
      permission: PERMISSIONS.CATEGORIES_WRITE,
      schema: AdminCategoryFormSchema,
      errorMessage: 'slug and title are required',
    });

    const newCategory: NewTaxonomy = {
      id: getUuid(),
      userId: user.id,
      parentId: '',
      slug: data.slug.toLowerCase(),
      type: TaxonomyType.CATEGORY,
      title: data.title,
      description: data.description ?? '',
      image: '',
      icon: '',
      status: TaxonomyStatus.PUBLISHED,
    };

    const result = await addTaxonomy(newCategory);
    if (!result) {
      throw new ActionError('add category failed');
    }

    return actionOk('category added', '/admin/categories');
  });
}

/**
 * Update an existing category
 */
export async function updateCategoryAction(id: string, formData: FormData) {
  return withAction(async () => {
    const { user, data } = await validateAndParseForm({
      formData,
      permission: PERMISSIONS.CATEGORIES_WRITE,
      schema: AdminCategoryFormSchema,
      errorMessage: 'slug and title are required',
    });

    const category = await findTaxonomy({ id });
    if (!category || category.userId !== user.id) {
      throw new ActionError('access denied');
    }

    const result = await updateTaxonomy(id, {
      parentId: '',
      slug: data.slug.toLowerCase(),
      title: data.title,
      description: data.description ?? '',
      image: '',
      icon: '',
      status: TaxonomyStatus.PUBLISHED,
    });

    if (!result) {
      throw new ActionError('update category failed');
    }

    return actionOk('category updated', '/admin/categories');
  });
}
