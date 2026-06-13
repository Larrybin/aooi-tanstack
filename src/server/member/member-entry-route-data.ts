import type { MemberEntryKind } from '@/surfaces/member/member-entry/member-entry.types';
import { createServerFn } from '@tanstack/react-start';

type MemberEntryInput = {
  locale: string;
  kind: MemberEntryKind;
  search?: unknown;
};

const memberEntryKinds = new Set<MemberEntryKind>(['settings', 'activity']);

export const loadMemberEntryRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): MemberEntryInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const kind = input.kind;

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      kind:
        typeof kind === 'string' &&
        memberEntryKinds.has(kind as MemberEntryKind)
          ? (kind as MemberEntryKind)
          : 'settings',
      search: input.search,
    };
  })
  .handler(async ({ data }) => {
    const { resolveMemberEntryRouteData } =
      await import('./member-entry-route-resolver');
    return resolveMemberEntryRouteData(data);
  });
