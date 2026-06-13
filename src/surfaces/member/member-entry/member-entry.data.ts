import { loadMemberEntryRouteData as loadServerMemberEntryRouteData } from '@/server/member/member-entry-route-data';

import type {
  MemberEntryKind,
  MemberEntryRouteData,
} from './member-entry.types';

export async function loadMemberEntryRouteData(input: {
  locale: string;
  kind: MemberEntryKind;
  search?: unknown;
}) {
  const data = await loadServerMemberEntryRouteData({
    data: input,
  });

  return data as MemberEntryRouteData | null;
}
