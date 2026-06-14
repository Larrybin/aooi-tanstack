import assert from 'node:assert/strict';
import test from 'node:test';

import { AIMediaType } from '@/extensions/ai';

import { createAiCapabilitiesGetHandler } from './capabilities-route';

test('ai/capabilities 路由返回 no-store 能力列表', async () => {
  const handler = createAiCapabilitiesGetHandler({
    listCapabilities: async () => [
      {
        mediaType: AIMediaType.IMAGE,
        scene: 'text-to-image',
        provider: 'replicate',
        model: 'black-forest-labs/flux-schnell',
        label: 'FLUX Schnell',
        costCredits: 2,
        isDefault: true,
      },
    ],
  });

  const response = await handler();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');

  const body = (await response.json()) as {
    data: { capabilities: Array<{ model: string }> };
  };
  assert.equal(
    body.data.capabilities[0]?.model,
    'black-forest-labs/flux-schnell'
  );
});
