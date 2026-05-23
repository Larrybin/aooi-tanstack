import type { ProductActor } from './actor';

export type ProductOwner = {
  userId: string | null;
  anonymousSessionId: string | null;
};

export function getProductActorOwner(actor: ProductActor): ProductOwner {
  if (actor.kind === 'user') {
    return {
      userId: actor.userId,
      anonymousSessionId: null,
    };
  }

  return {
    userId: null,
    anonymousSessionId: actor.anonymousSessionId,
  };
}

export function getProductOwnerKey(owner: ProductOwner): string {
  return owner.userId
    ? `user:${owner.userId}`
    : `anonymous:${owner.anonymousSessionId ?? 'none'}`;
}

export function assertProductActorOwnsResource(
  actor: ProductActor,
  resource: ProductOwner
): boolean {
  if (actor.kind === 'user') {
    if (resource.userId === actor.userId) {
      return true;
    }

    return (
      !resource.userId &&
      !!resource.anonymousSessionId &&
      !!actor.anonymousSessionId &&
      resource.anonymousSessionId === actor.anonymousSessionId
    );
  }

  return (
    !resource.userId &&
    !!resource.anonymousSessionId &&
    resource.anonymousSessionId === actor.anonymousSessionId
  );
}
