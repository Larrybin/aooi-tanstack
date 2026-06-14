import { jsonOk } from '@/shared/lib/api/response';
import type { AICapability } from '@/shared/types/ai-capability';

type AiCapabilitiesRouteDeps = {
  listCapabilities: () => Promise<AICapability[]>;
};

export function createAiCapabilitiesGetHandler(deps: AiCapabilitiesRouteDeps) {
  return async () => {
    const capabilities = await deps.listCapabilities();

    return jsonOk(
      { capabilities },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  };
}
