import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ActivityRouteData } from './activity.types';
import { ActivityRouteView } from './activity.view';

test('ActivityRouteView renders ai task result and actions', () => {
  const html = renderToStaticMarkup(
    <ActivityRouteView data={createActivityData()} />
  );

  assert.match(html, /AI Tasks/);
  assert.match(html, /Prompt/);
  assert.match(html, /Refresh Task/);
  assert.match(html, /Generated image/);
});

test('ActivityRouteView renders no-auth message', () => {
  const html = renderToStaticMarkup(
    <ActivityRouteView
      data={{
        ...createActivityData(),
        viewer: { signedIn: false },
        page: {
          ...createActivityData().page,
          rows: [],
        },
      }}
    />
  );

  assert.match(html, /Please sign in to continue/);
  assert.doesNotMatch(html, /Refresh Task/);
});

function createActivityData(): ActivityRouteData {
  return {
    locale: 'en',
    canonicalPath: '/activity/ai-tasks',
    head: {},
    shell: {
      title: 'Activity',
      nav: {
        items: [{ title: 'AI Tasks', url: '/activity/ai-tasks' }],
      },
      topNav: {
        items: [{ title: 'Activity', url: '/activity' }],
      },
    },
    viewer: {
      signedIn: true,
    },
    page: {
      kind: 'ai-tasks',
      title: 'AI Tasks',
      noAuthMessage: 'Please sign in to continue',
      emptyMessage: 'No tasks found',
      tabs: [{ title: 'All', url: '/activity/ai-tasks', active: true }],
      columns: [
        { key: 'prompt', title: 'Prompt' },
        { key: 'result', title: 'Result' },
        { key: 'action', title: 'Action' },
      ],
      rows: [
        {
          id: 'task-1',
          values: {
            prompt: 'make image',
          },
          result: {
            kind: 'images',
            images: [{ imageUrl: 'https://example.test/image.png' }],
          },
          actions: [
            {
              title: 'Refresh Task',
              url: '/activity/ai-tasks/task-1/refresh',
            },
          ],
        },
      ],
      buttons: [],
      pagination: {
        total: 1,
        page: 1,
        pageSize: 20,
        previousHref: null,
        nextHref: null,
      },
    },
  };
}
