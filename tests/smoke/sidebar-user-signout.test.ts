import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const rootDir = process.cwd();

test('SidebarUser sign-out redirects without triggering a full-page reload first', async () => {
  const source = await readFile(
    path.join(rootDir, 'src/shared/blocks/workspace/sidebar-user.tsx'),
    'utf8'
  );
  const signOutBlock = source.match(
    /const handleSignOut = async \(\) => \{[\s\S]*?\n  \};/
  )?.[0];

  assert.ok(signOutBlock, 'handleSignOut should stay explicit');
  assert.doesNotMatch(signOutBlock, /router\.refresh\(\)/);
  assert.match(signOutBlock, /router\.replace\(user\.signout_callback \|\| '\/sign-in'\)/);
});
