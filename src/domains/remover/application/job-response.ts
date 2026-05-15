import type { RemoverActor } from '../domain/types';
import type { RemoverJob } from '../infra/job';

export function serializeRemoverJobForClient({
  actor,
  job,
}: {
  actor: RemoverActor;
  job: RemoverJob;
}) {
  const hasOutput = Boolean(job.outputImageKey);
  const hasLowResOutput = Boolean(job.thumbnailKey);

  return {
    id: job.id,
    status: job.status,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    expiresAt: job.expiresAt,
    lowResDownloadAvailable: job.status === 'succeeded' && hasLowResOutput,
    highResDownloadRequiresSignIn:
      job.status === 'succeeded' && hasOutput && actor.kind !== 'user',
  };
}
