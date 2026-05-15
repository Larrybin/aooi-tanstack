import type { ApiContext } from '@/app/api/_lib/context';
import type { createQueuedRemoverJob } from '@/domains/remover/application/jobs';
import type { submitRemoverJobToProvider } from '@/domains/remover/application/processing';
import type { RemoverProviderAdapter } from '@/domains/remover/application/provider';
import { serializeRemoverJobForClient } from '@/domains/remover/application/job-response';
import type { RemoverActor } from '@/domains/remover/domain/types';

import { jsonOk } from '@/shared/lib/api/response';
import { RemoverJobCreateBodySchema } from '@/shared/schemas/api/remover';

type JobsActionDeps = {
  createApiContext: (req: Request) => ApiContext;
  resolveActor: (req: Request) => Promise<RemoverActor>;
  createQueuedRemoverJob: typeof createQueuedRemoverJob;
  resolveProviderAdapter: () => Promise<RemoverProviderAdapter>;
  submitRemoverJobToProvider: typeof submitRemoverJobToProvider;
  jobDeps: Parameters<typeof createQueuedRemoverJob>[0]['deps'];
  submitDeps: Omit<
    Parameters<typeof submitRemoverJobToProvider>[0]['deps'],
    'providerAdapter'
  >;
  acquireGuestIpLimit?: (input: {
    actor: RemoverActor;
    req: Request;
  }) => Promise<(() => Promise<void>) | undefined>;
};

export function createRemoverJobsPostAction(deps: JobsActionDeps) {
  return async (req: Request) => {
    const api = deps.createApiContext(req);
    const actor = await deps.resolveActor(req);
    const body = await api.parseJson(RemoverJobCreateBodySchema);
    const providerAdapter: RemoverProviderAdapter =
      await deps.resolveProviderAdapter();
    const releaseGuestIpLimit = await deps.acquireGuestIpLimit?.({ actor, req });
    try {
      const result = await deps.createQueuedRemoverJob({
        actor,
        inputImageAssetId: body.inputImageAssetId,
        maskImageAssetId: body.maskImageAssetId,
        idempotencyKey: body.idempotencyKey,
        providerConfig: providerAdapter.config,
        deps: deps.jobDeps,
      });
      const shouldSubmit =
        !result.job.providerTaskId &&
        (result.job.status === 'queued' || result.job.status === 'processing');
      const job = shouldSubmit
        ? await deps.submitRemoverJobToProvider({
            actor,
            jobId: result.job.id,
            deps: {
              ...deps.submitDeps,
              providerAdapter,
            },
          })
        : result.job;
      return jsonOk(
        {
          ...result,
          job: serializeRemoverJobForClient({ actor, job }),
        },
        {
          status: result.reused ? 200 : 201,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    } finally {
      await releaseGuestIpLimit?.().catch(() => undefined);
    }
  };
}
