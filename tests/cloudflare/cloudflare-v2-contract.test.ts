import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listSiteKeys,
  resolveSiteCloudflareContract,
} from '../../scripts/cloudflare/contract';
import {
  buildReleaseSteps,
  hasAnalyticsProvider,
} from '../../scripts/cloudflare/release';
import {
  buildAppWranglerConfig,
  buildStateWranglerConfig,
} from '../../scripts/cloudflare/wrangler';

test('every site uses the v2 app/state deploy contract', () => {
  for (const siteKey of listSiteKeys()) {
    const contract = resolveSiteCloudflareContract({ siteKey });

    assert.equal(contract.deploySettings.configVersion, 2);
    assert.ok(contract.workers.app);
    assert.deepEqual(Object.keys(contract.workers).sort(), [
      'app',
      ...(contract.requires.state ? ['state'] : []),
    ]);
  }
});

test('401k keeps the existing router identity without database, storage, or state', () => {
  const contract = resolveSiteCloudflareContract({
    siteKey: '401k-calculator',
  });

  assert.equal(contract.workers.app, 'aooi-401k-calculator-router');
  assert.deepEqual(contract.resources, {});
  assert.equal(contract.requires.database, false);
  assert.equal(contract.requires.state, false);
  assert.equal(contract.requires.r2, false);
  assert.equal(contract.requires.workersAi, false);
});

test('product and module contracts derive bindings instead of deploy settings flags', () => {
  const remover = resolveSiteCloudflareContract({ siteKey: 'ai-remover' });
  const tts = resolveSiteCloudflareContract({
    siteKey: 'text-to-speech-generator',
  });

  assert.equal(remover.requires.database, true);
  assert.equal(remover.requires.r2, true);
  assert.equal(remover.requires.workersAi, true);
  assert.equal(remover.requires.state, true);
  assert.ok(remover.requiredSecrets.includes('REMOVER_CLEANUP_SECRET'));

  assert.equal(tts.requires.workersAi, true);
  assert.equal(tts.requires.state, true);
  assert.ok(tts.requiredSecrets.includes('TURNSTILE_SECRET_KEY'));
  assert.ok(tts.requiredVars.includes('NEXT_PUBLIC_TURNSTILE_SITE_KEY'));
});

test('Wrangler output contains only app/state topology', () => {
  const contract = resolveSiteCloudflareContract({ siteKey: 'ai-remover' });
  const app = buildAppWranglerConfig(contract, {
    configPath: '/repo/.generated/cloudflare/ai-remover/wrangler.app.toml',
    rootDir: '/repo',
  });
  const state = buildStateWranglerConfig(contract, {
    configPath: '/repo/.generated/cloudflare/ai-remover/wrangler.state.toml',
    rootDir: '/repo',
  });

  assert.match(app, /main = ".+cloudflare\/workers\/app\.ts"/);
  assert.match(app, /name = "aooi-ai-remover-router"/);
  assert.match(app, /name = "STATEFUL_LIMITERS"/);
  assert.match(state, /main = ".+cloudflare\/workers\/state\.ts"/);
  assert.doesNotMatch(app, /\[\[services\]\]/);
  assert.doesNotMatch(app, /WORKER_VERSION_ID|PUBLIC_WEB_WORKER/);
  assert.match(app, /\[triggers\]\ncrons = \["17 3 \* \* \*"\]/);
});

test('release ordering is migrate, journal check, optional state, then app', () => {
  const databaseSite = resolveSiteCloudflareContract({ siteKey: 'ai-remover' });
  const analyticsSite = resolveSiteCloudflareContract({
    siteKey: '401k-calculator',
  });

  assert.deepEqual(buildReleaseSteps(databaseSite), [
    'db:migrate',
    'db:check',
    'cf:deploy:state',
    'cf:deploy:app',
  ]);
  assert.deepEqual(buildReleaseSteps(analyticsSite), ['cf:deploy:app']);
});

test('production analytics gate requires at least one configured provider', () => {
  assert.equal(hasAnalyticsProvider({}), false);
  assert.equal(hasAnalyticsProvider({ GOOGLE_ANALYTICS_ID: 'G-TEST' }), true);
  assert.equal(hasAnalyticsProvider({ CLARITY_ID: 'clarity-test' }), true);
});
