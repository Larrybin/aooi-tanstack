export type MemberEntryKind = 'settings' | 'activity';

export type MemberEntryRouteData = {
  locale: string;
  kind: MemberEntryKind;
  redirectTo: string;
};
