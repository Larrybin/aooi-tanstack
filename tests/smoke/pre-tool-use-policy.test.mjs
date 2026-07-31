import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function runPolicy(command) {
  return spawnSync('node', ['.codex/hooks/pre_tool_use_policy.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command },
    }),
  });
}

test('pre-tool policy allows Cloudflare production release commands', () => {
  for (const command of [
    'SITE=401k-calculator pnpm release:cf',
    'SITE=401k-calculator pnpm cf:deploy:state',
    'SITE=401k-calculator pnpm cf:deploy:app',
    'pnpm exec wrangler deploy',
  ]) {
    const result = runPolicy(command);

    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  }
});

test('pre-tool policy keeps destructive git commands blocked', () => {
  const result = runPolicy('git reset --hard');
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
});
