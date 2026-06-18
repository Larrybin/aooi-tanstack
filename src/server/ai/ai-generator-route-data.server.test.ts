import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAiGeneratorRouteData } from './ai-generator-route-resolver';

type AiGeneratorRouteDeps = NonNullable<
  Parameters<typeof resolveAiGeneratorRouteData>[1]
>;

function publicConfig(aiEnabled: boolean) {
  return {
    aiEnabled,
    localeSwitcherEnabled: false,
    socialLinksEnabled: false,
    socialLinksJson: '',
    socialLinks: [],
    affiliate: {
      affonsoEnabled: false,
      promotekitEnabled: false,
    },
  };
}

function buildDeps(aiEnabled: boolean): AiGeneratorRouteDeps {
  return {
    readBuildPublicUiConfig: () => publicConfig(aiEnabled),
  };
}

test('resolveAiGeneratorRouteData returns null when AI is disabled', async () => {
  assert.equal(
    await resolveAiGeneratorRouteData(
      { locale: 'en', kind: 'image' },
      buildDeps(false)
    ),
    null
  );
});

test('resolveAiGeneratorRouteData loads image generator route copy', async () => {
  const data = await resolveAiGeneratorRouteData(
    { locale: 'en', kind: 'image' },
    buildDeps(true)
  );

  assert.ok(data);
  assert.equal(data.kind, 'image');
  assert.equal(data.canonicalPath, '/ai-image-generator');
  assert.equal(data.page.title, 'AI Image Generator');
  assert.equal(data.generatorMessages.title, 'Image Generator');
});

test('resolveAiGeneratorRouteData loads music generator route copy', async () => {
  const data = await resolveAiGeneratorRouteData(
    { locale: 'en', kind: 'music' },
    buildDeps(true)
  );

  assert.ok(data);
  assert.equal(data.kind, 'music');
  assert.equal(data.canonicalPath, '/ai-music-generator');
  assert.equal(data.page.title, 'AI Music Generator');
  assert.equal(
    (data.generatorMessages.generator as Record<string, unknown>).title,
    'Music Generator'
  );
});

test('resolveAiGeneratorRouteData loads chatbot demo route copy', async () => {
  const data = await resolveAiGeneratorRouteData(
    { locale: 'zh', kind: 'chatbot' },
    buildDeps(true)
  );

  assert.ok(data);
  assert.equal(data.kind, 'chatbot');
  assert.equal(data.canonicalPath, '/zh/ai-chatbot');
  assert.equal(data.page.title, 'AI 聊天机器人');
  assert.equal(data.page.description, '与 AI 助手对话，体验演示功能。');
});
