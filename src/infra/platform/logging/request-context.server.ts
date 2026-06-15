
import { getOrCreateRequestId } from '@/infra/platform/logging/request-id.server';

export type RequestContext = {
  route: string;
  requestId: string;
  method?: string;
};

function safePathname(url: string): string {
  try {
    return new URL(url).pathname || '';
  } catch {
    return '';
  }
}

/**
 * 低层工具：仅负责从 Request 提取 `{route, requestId, method}`。
 *
 * 推荐：在 Route Handler 中优先使用 `getRequestLogger(req)`，
 * 以便同时获得 `ctx`（route/requestId/method）与绑定上下文的 `log`。
 */
export function getRequestContext(req: Request): RequestContext {
  return {
    route: safePathname(req.url) || '',
    requestId: getOrCreateRequestId(req.headers),
    method: req.method,
  };
}
