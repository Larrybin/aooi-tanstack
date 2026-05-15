import type { RemoverActor, RemoverOwner } from './types';

export function getRemoverOwner(actor: RemoverActor): RemoverOwner {
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

export function assertActorOwnsResource(
  actor: RemoverActor,
  resource: RemoverOwner
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
