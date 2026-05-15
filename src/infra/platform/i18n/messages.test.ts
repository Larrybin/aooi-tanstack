import assert from 'node:assert/strict';
import test from 'node:test';

import { getScopedMessages } from './messages';
import {
  getRequestNamespaces,
  normalizeAppPathname,
  resolveMessagePath,
} from './messages.shared';

test('normalizeAppPathname 会去掉 locale 前缀并标准化结尾斜杠', () => {
  assert.equal(normalizeAppPathname('/zh/pricing/'), '/pricing');
  assert.equal(normalizeAppPathname('/pricing?tab=monthly'), '/pricing');
  assert.equal(normalizeAppPathname('/'), '/');
});

test('resolveMessagePath 会把 namespace 映射到真实消息文件', () => {
  assert.equal(resolveMessagePath('common.locale_switcher'), 'common');
  assert.equal(resolveMessagePath('admin.sidebar.header'), 'admin/sidebar');
  assert.equal(
    resolveMessagePath('admin.settings.brand_preview'),
    'admin/settings'
  );
  assert.equal(resolveMessagePath('ai.chat.generator'), 'ai/chat');
});

test('getRequestNamespaces 会按路由收敛服务端消息集', () => {
  assert.deepEqual(getRequestNamespaces('/zh/pricing'), [
    'common.metadata',
    'landing',
    'pricing',
  ]);
  assert.deepEqual(getRequestNamespaces('/zh/admin/settings/general'), [
    'common.metadata',
    'admin.sidebar',
    'admin.settings',
  ]);
  assert.deepEqual(getRequestNamespaces('/api/payment/checkout'), []);
});

test('getRequestNamespaces: admin/settings/activity 分支遵循固定规则优先级', () => {
  assert.deepEqual(getRequestNamespaces('/admin/users/1'), [
    'common.metadata',
    'admin.sidebar',
    'admin.users',
  ]);

  assert.deepEqual(getRequestNamespaces('/admin/settings/apikeys'), [
    'common.metadata',
    'admin.sidebar',
    'admin.settings',
  ]);

  assert.deepEqual(getRequestNamespaces('/settings/profile/security'), [
    'common.metadata',
    'landing',
    'settings.sidebar',
    'settings.profile',
  ]);

  assert.deepEqual(getRequestNamespaces('/activity/chats/1'), [
    'common.metadata',
    'landing',
    'activity.sidebar',
    'activity.chats',
  ]);
});

test('getRequestNamespaces: 终止规则与默认回退保持一致', () => {
  assert.deepEqual(getRequestNamespaces('/blog/hello-world'), [
    'common.metadata',
    'landing',
    'blog',
  ]);

  assert.deepEqual(getRequestNamespaces('/docs/quick-start'), [
    'common.metadata',
  ]);

  assert.deepEqual(getRequestNamespaces('/no-permission'), ['common.metadata']);

  assert.deepEqual(getRequestNamespaces('/unknown-page'), [
    'common.metadata',
    'landing',
  ]);
});

test('getScopedMessages 只加载当前请求需要的 namespace', async () => {
  const messages = await getScopedMessages('zh-TW', [
    'common.metadata',
    'pricing',
  ]);

  assert.equal(typeof messages.common, 'object');
  assert.equal(typeof messages.pricing, 'object');
  assert.deepEqual(Object.keys(messages.common as object), ['metadata']);
  assert.equal('landing' in messages, false);
  assert.equal('admin' in messages, false);
  assert.equal('settings' in messages, false);
});

test('getScopedMessages 对同一文件内的 common 子 namespace 做精确裁剪', async () => {
  const messages = await getScopedMessages('en', ['common.sign']);
  const common = messages.common as Record<string, unknown>;

  assert.equal(typeof common.sign, 'object');
  assert.equal('metadata' in common, false);
  assert.equal('payment' in common, false);
});

test('getRequestNamespaces: checkout API 不再加载全局 pricing 翻译', () => {
  assert.equal(
    getRequestNamespaces('/api/payment/checkout').includes('pricing'),
    false
  );
});
