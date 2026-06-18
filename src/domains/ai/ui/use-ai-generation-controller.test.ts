import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildAiSignInUrl,
  isAIGenerationTaskResponse,
} from './use-ai-generation-controller';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

test('isAIGenerationTaskResponse: 校验 query 返回结构', () => {
  assert.equal(
    isAIGenerationTaskResponse({
      id: 'task_1',
      status: 'processing',
      provider: 'replicate',
      model: 'google/nano-banana',
      prompt: 'hello',
      taskInfo: {},
    }),
    true
  );

  assert.equal(
    isAIGenerationTaskResponse({
      id: 'task_1',
      status: 'processing',
      provider: 'replicate',
      model: 123,
      prompt: 'hello',
      taskInfo: {},
    }),
    false
  );
});

test('useAiGenerationController: capability 选择逻辑只从 canonical 纯函数导入', async () => {
  const content = await readFile(
    path.resolve(currentDir, 'use-ai-generation-controller.ts'),
    'utf8'
  );

  assert.equal(
    content.includes(
      "import { resolveAICapabilitySelection } from '@/domains/ai/domain/capability-selection';"
    ),
    true
  );
  assert.equal(
    content.includes('export function resolveAICapabilitySelection('),
    false
  );
});

test('buildAiSignInUrl localizes sign-in redirects for AI callbacks', () => {
  assert.equal(
    buildAiSignInUrl({
      callbackUrl: '/zh/ai-image-generator?model=image',
      locale: 'zh',
    }),
    '/zh/sign-in?callbackUrl=%2Fai-image-generator%3Fmodel%3Dimage'
  );

  assert.equal(
    buildAiSignInUrl({
      callbackUrl: '/ai-music-generator',
      locale: 'en',
    }),
    '/sign-in?callbackUrl=%2Fai-music-generator'
  );
});

test('useAiGenerationController redirects to sign-in when inline modal cannot open', async () => {
  const content = await readFile(
    path.resolve(currentDir, 'use-ai-generation-controller.ts'),
    'utf8'
  );

  assert.equal(content.includes('const promptSignIn = useCallback'), true);
  assert.equal(content.includes('canOpenInlineSignModal'), true);
  assert.equal(content.includes('window.location.assign'), true);
  assert.equal(content.includes('buildAiSignInUrl({'), true);
  assert.equal(content.includes('promptSignIn();'), true);
});
