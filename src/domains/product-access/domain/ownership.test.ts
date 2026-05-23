import assert from 'node:assert/strict';
import test from 'node:test';

import type { ProductActor } from './actor';
import {
  assertProductActorOwnsResource,
  getProductActorOwner,
  getProductOwnerKey,
} from './ownership';

test('guest actor resolves a stable anonymous owner', () => {
  const actor = {
    kind: 'anonymous',
    anonymousSessionId: 'anon_guest_123',
  } satisfies ProductActor;

  const owner = getProductActorOwner(actor);

  assert.deepEqual(owner, {
    userId: null,
    anonymousSessionId: 'anon_guest_123',
  });
  assert.equal(getProductOwnerKey(owner), 'anonymous:anon_guest_123');
});

test('user actor resolves a stable user owner', () => {
  const actor = {
    kind: 'user',
    userId: 'user_1',
    anonymousSessionId: 'anon_guest_123',
  } satisfies ProductActor;

  const owner = getProductActorOwner(actor);

  assert.deepEqual(owner, {
    userId: 'user_1',
    anonymousSessionId: null,
  });
  assert.equal(getProductOwnerKey(owner), 'user:user_1');
});

test('actor ownership allows only owned resources', () => {
  const guestActor = {
    kind: 'anonymous',
    anonymousSessionId: 'anon_guest_123',
  } satisfies ProductActor;
  const userActor = {
    kind: 'user',
    userId: 'user_1',
    anonymousSessionId: 'anon_guest_123',
  } satisfies ProductActor;

  assert.equal(
    assertProductActorOwnsResource(guestActor, {
      userId: null,
      anonymousSessionId: 'anon_guest_123',
    }),
    true
  );
  assert.equal(
    assertProductActorOwnsResource(guestActor, {
      userId: null,
      anonymousSessionId: 'anon_other_123',
    }),
    false
  );
  assert.equal(
    assertProductActorOwnsResource(guestActor, {
      userId: 'user_1',
      anonymousSessionId: null,
    }),
    false
  );
  assert.equal(
    assertProductActorOwnsResource(userActor, {
      userId: 'user_1',
      anonymousSessionId: null,
    }),
    true
  );
  assert.equal(
    assertProductActorOwnsResource(userActor, {
      userId: null,
      anonymousSessionId: 'anon_guest_123',
    }),
    true
  );
  assert.equal(
    assertProductActorOwnsResource(userActor, {
      userId: 'user_2',
      anonymousSessionId: null,
    }),
    false
  );
  assert.equal(
    assertProductActorOwnsResource(userActor, {
      userId: null,
      anonymousSessionId: 'anon_other_123',
    }),
    false
  );
});
