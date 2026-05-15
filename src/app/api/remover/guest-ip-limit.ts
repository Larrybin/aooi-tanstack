import type { RemoverActor } from '@/domains/remover/domain/types';

import { TooManyRequestsError } from '@/shared/lib/api/errors';

type GuestIpLimiter = {
  acquire(key: string): Promise<{ allowed: boolean; reason?: string }>;
  release(key: string): Promise<void>;
};

export function resolveRemoverGuestIp(req: Request): string {
  const cloudflareIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || 'unknown';
}

export async function acquireRemoverGuestIpLimit({
  actor,
  req,
  limiter,
}: {
  actor: RemoverActor;
  req: Request;
  limiter: GuestIpLimiter;
}): Promise<(() => Promise<void>) | undefined> {
  if (actor.kind !== 'anonymous') {
    return;
  }

  const key = resolveRemoverGuestIp(req);
  const result = await limiter.acquire(key);
  if (!result.allowed) {
    throw new TooManyRequestsError('remover guest limit exceeded', {
      reason: result.reason,
    });
  }

  return () => limiter.release(key);
}
