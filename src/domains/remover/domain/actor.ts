import {
  assertProductActorOwnsResource,
  getProductActorOwner,
} from '@/domains/product-access/domain/ownership';

import type { RemoverActor, RemoverOwner } from './types';

export function getRemoverOwner(actor: RemoverActor): RemoverOwner {
  return getProductActorOwner(actor);
}

export function assertActorOwnsResource(
  actor: RemoverActor,
  resource: RemoverOwner
): boolean {
  return assertProductActorOwnsResource(actor, resource);
}
