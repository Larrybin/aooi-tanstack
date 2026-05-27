import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const localizeSkill = readFileSync(
  '.codex/skills/i18n-localize/SKILL.md',
  'utf8'
);
const reviewSkill = readFileSync('.codex/skills/i18n-review/SKILL.md', 'utf8');

test('i18n-localize skill keeps generated content pending', () => {
  assert.match(localizeSkill, /name: i18n-localize/);
  assert.match(localizeSkill, /Never write `approved`/);
  assert.match(localizeSkill, /Set `status` to `pending`/);
  assert.match(localizeSkill, /pnpm i18n:check --site <site-key> --strict/);
});

test('i18n-review skill requires explicit approval before approved status', () => {
  assert.match(reviewSkill, /name: i18n-review/);
  assert.match(reviewSkill, /explicitly confirms the exact locale\/page list/);
  assert.match(
    reviewSkill,
    /show the actual entries that will become `approved`/
  );
  assert.match(reviewSkill, /pnpm i18n:check --site <site-key> --strict/);
});

test('i18n skills document current rollout scope', () => {
  for (const skill of [localizeSkill, reviewSkill]) {
    assert.match(skill, /`dev-local` and `mamamiya` are legacy\/optional/);
    assert.match(skill, /`ai-remover`, `background-remover`, and future/);
  }
});
