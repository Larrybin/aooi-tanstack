import { refreshMemberAiTaskUseCase } from '@/domains/ai/application/member-ai-tasks.actions';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';
import { readPublicUiConfigFresh } from '@/domains/settings/application/settings-runtime.query';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { site } from '@/site';
import type { ActivityRefreshRouteData } from '@/surfaces/member/activity-refresh/activity-refresh.types';

import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import { buildCanonicalUrl, buildSeoHead } from '@/shared/seo/canonical';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

import {
  loadActivityRouteMessages,
  type ActivityRouteMessages,
} from './activity-route-messages';

type ActivityRefreshRouteInput = {
  locale: unknown;
  id: unknown;
};

type ActivityRefreshRouteResolverDeps = {
  readPublicUiConfig?: () => Promise<PublicUiConfig>;
  readSignedInUserIdentity?: () => Promise<AuthSessionUserIdentity | null>;
  refreshMemberAiTask?: typeof refreshMemberAiTaskUseCase;
};

const aiTasksPath = '/activity/ai-tasks' as const;

export async function resolveActivityAiTaskRefreshRouteData(
  input: ActivityRefreshRouteInput,
  deps: ActivityRefreshRouteResolverDeps = {}
): Promise<ActivityRefreshRouteData | null> {
  const locale = normalizeLocale(
    typeof input.locale === 'string' ? input.locale : null
  );
  const id = typeof input.id === 'string' ? input.id : '';
  if (!locale || !id) {
    return null;
  }

  const publicUiConfig = await (
    deps.readPublicUiConfig ?? readPublicUiConfigFresh
  )();
  if (!isAiEnabled(publicUiConfig)) {
    return null;
  }

  const messages = await loadActivityRouteMessages(locale);
  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  const signedInUser = await readSignedInUserIdentity();

  if (!signedInUser) {
    return serializeRouteData(
      buildMessageData(messages, locale, id, 'task_not_found')
    );
  }

  const refresh = deps.refreshMemberAiTask ?? refreshMemberAiTaskUseCase;
  const result = await refresh({
    taskId: id,
    actorUserId: signedInUser.id,
  });

  if (result.status === 'ok') {
    return serializeRouteData({
      ...buildMessageData(messages, locale, id, 'task_not_found'),
      redirectTo: localePath(aiTasksPath, locale),
    });
  }

  if (result.status === 'hidden') {
    return serializeRouteData(
      buildMessageData(messages, locale, id, 'task_not_found')
    );
  }

  return serializeRouteData(
    buildMessageData(messages, locale, id, 'invalid_ai_provider')
  );
}

async function readCurrentSignedInUserIdentity() {
  const { getRequest } = await import('@tanstack/react-start/server');
  return getSignedInUserIdentityFromRequest(getRequest());
}

function buildMessageData(
  messages: ActivityRouteMessages,
  locale: string,
  id: string,
  errorKey: 'task_not_found' | 'invalid_ai_provider'
): ActivityRefreshRouteData {
  const aiTasks = messages.aiTasks;
  const list = getObject(aiTasks.list);
  const errors = getObject(aiTasks.errors);
  const title = readString(list.title, 'AI Tasks');
  const canonicalPath =
    `${aiTasksPath}/${id}/refresh` as ActivityRefreshRouteData['canonicalPath'];
  const head = buildSeoHead({
    title: `${title} - ${site.brand.appName}`,
    description: title,
    canonical: buildCanonicalUrl(canonicalPath, locale),
    locale,
    siteName: site.brand.appName,
  });

  return {
    locale,
    canonicalPath,
    redirectTo: null,
    head: {
      ...head,
      meta: [
        ...(head.meta ?? []),
        { name: 'robots', content: 'noindex,nofollow' },
      ],
    },
    page: {
      title,
      message: readString(errors[errorKey], fallbackMessage(errorKey)),
      backHref: localePath(aiTasksPath, locale),
      backLabel: title,
    },
  };
}

function fallbackMessage(errorKey: 'task_not_found' | 'invalid_ai_provider') {
  return errorKey === 'task_not_found'
    ? 'Task not found'
    : 'Invalid AI provider';
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback;
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function serializeRouteData(data: unknown) {
  return JSON.parse(JSON.stringify(data)) as ActivityRefreshRouteData;
}
