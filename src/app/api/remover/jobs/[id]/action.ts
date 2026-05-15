import type { ApiContext } from '@/app/api/_lib/context';
import type {
  claimRemoverJobForActor,
  getRemoverJobForActor,
} from '@/domains/remover/application/jobs';
import { serializeRemoverJobForClient } from '@/domains/remover/application/job-response';
import type {
  refreshRemoverJobStatus,
  submitRemoverJobToProvider,
} from '@/domains/remover/application/processing';
import type { RemoverProviderAdapter } from '@/domains/remover/application/provider';
import type { RemoverActor } from '@/domains/remover/domain/types';

import { jsonOk } from '@/shared/lib/api/response';
import { RemoverJobParamsSchema } from '@/shared/schemas/api/remover';

type JobStatusActionDeps = {
  createApiContext: (req: Request) => ApiContext;
  resolveActor: (req: Request) => Promise<RemoverActor>;
  getRemoverJobForActor: typeof getRemoverJobForActor;
  refreshRemoverJobStatus: typeof refreshRemoverJobStatus;
  resolveProviderAdapter: () => Promise<RemoverProviderAdapter>;
  jobDeps: Parameters<typeof getRemoverJobForActor>[0]['deps'];
  claimDeps: Parameters<typeof claimRemoverJobForActor>[0]['deps'];
  claimRemoverJobForActor: typeof claimRemoverJobForActor;
  refreshDeps: Omit<
    Parameters<typeof refreshRemoverJobStatus>[0]['deps'],
    'providerAdapter'
  >;
  submitRemoverJobToProvider: typeof submitRemoverJobToProvider;
  submitDeps: Omit<
    Parameters<typeof submitRemoverJobToProvider>[0]['deps'],
    'providerAdapter'
  >;
};

export function createRemoverJobGetAction(deps: JobStatusActionDeps) {
  return async (
    req: Request,
    context: { params: Promise<{ id: string }> }
  ) => {
    const api = deps.createApiContext(req);
    const actor = await deps.resolveActor(req);
    const params = await api.parseParams(context.params, RemoverJobParamsSchema);
    const accessibleJob = await deps.getRemoverJobForActor({
      actor,
      jobId: params.id,
      deps: deps.jobDeps,
    });
    const currentJob = await deps.claimRemoverJobForActor({
      actor,
      job: accessibleJob,
      deps: deps.claimDeps,
    });
    let job = currentJob;
    if (currentJob.status === 'queued' || currentJob.status === 'processing') {
      const providerAdapter = await deps.resolveProviderAdapter();
      job = currentJob.providerTaskId
        ? await deps.refreshRemoverJobStatus({
            actor,
            jobId: currentJob.id,
            deps: {
              ...deps.refreshDeps,
              providerAdapter,
            },
          })
        : await deps.submitRemoverJobToProvider({
            actor,
            jobId: currentJob.id,
            deps: {
              ...deps.submitDeps,
              providerAdapter,
            },
          });
    }
    return jsonOk(
      {
        job: serializeRemoverJobForClient({ actor, job }),
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  };
}
