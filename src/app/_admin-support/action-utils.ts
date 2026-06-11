import 'server-only';

import {
  requireActionPermission,
  requireActionUser,
  type PermissionCode,
} from '@/app/access-control/action-guard';
import type { z } from 'zod';

import { parseFormData } from '@/shared/lib/action/form';

type User = Awaited<ReturnType<typeof requireActionUser>>;

export async function validateAndParseForm<T extends z.ZodSchema>({
  formData,
  permission,
  schema,
  errorMessage,
}: {
  formData: FormData;
  permission: PermissionCode;
  schema: T;
  errorMessage: string;
}): Promise<{ user: User; data: z.infer<T> }> {
  const user = await requireActionUser();
  await requireActionPermission(user.id, permission);
  const data = parseFormData(formData, schema, { message: errorMessage });
  return { user, data };
}

export async function validatePermission(
  permission: PermissionCode
): Promise<User> {
  const user = await requireActionUser();
  await requireActionPermission(user.id, permission);
  return user;
}
