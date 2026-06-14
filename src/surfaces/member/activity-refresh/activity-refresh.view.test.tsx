import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ActivityRefreshRouteData } from './activity-refresh.types';
import { ActivityRefreshRouteView } from './activity-refresh.view';

test('ActivityRefreshRouteView renders message and back link', () => {
  const html = renderToStaticMarkup(
    <ActivityRefreshRouteView data={createRefreshData()} />
  );

  assert.match(html, /Invalid AI provider/);
  assert.match(html, /href="\/activity\/ai-tasks"/);
});

function createRefreshData(): ActivityRefreshRouteData {
  return {
    locale: 'en',
    canonicalPath: '/activity/ai-tasks/task-1/refresh',
    redirectTo: null,
    head: {},
    page: {
      title: 'AI Tasks',
      message: 'Invalid AI provider',
      backHref: '/activity/ai-tasks',
      backLabel: 'AI Tasks',
    },
  };
}
