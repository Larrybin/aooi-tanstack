import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('repository Stop hook stays disabled without removing safety hooks', () => {
  const config = JSON.parse(readFileSync('.codex/hooks.json', 'utf8'));

  assert.equal('Stop' in config.hooks, false);
  assert.equal(existsSync('.codex/hooks/stop_guard.mjs'), false);
  assert.ok(config.hooks.SessionStart);
  assert.ok(config.hooks.PreToolUse);
});

test('active architecture guidance does not reference deleted route or rule machinery', () => {
  const layering = readFileSync('docs/architecture/shared-layering.md', 'utf8');
  const archivedReview = readFileSync(
    'docs/archive/architecture/ARCHITECTURE_REVIEW.md',
    'utf8'
  );
  const skill = readFileSync(
    '.codex/skills/aooi-site-factory/SKILL.md',
    'utf8'
  );

  assert.doesNotMatch(layering, /architecture-rules\.cjs/);
  assert.doesNotMatch(archivedReview, /architecture-rules\.cjs/);
  assert.doesNotMatch(skill, /route pruning/i);
});

test('generated server import typing is stable before and after local builds', () => {
  const worker = readFileSync('cloudflare/workers/app.ts', 'utf8');
  const declaration = readFileSync(
    'src/shared/types/tanstack-native-server-generated.d.ts',
    'utf8'
  );

  assert.doesNotMatch(worker, /@ts-expect-error/);
  assert.match(
    declaration,
    /declare module ['"]\*dist\/server\/entry\.server\.mjs['"]/
  );
});
