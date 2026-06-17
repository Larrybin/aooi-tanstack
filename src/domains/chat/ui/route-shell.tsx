'use client';

import type { ReactNode } from 'react';

import { AuthSnapshotProvider } from '@/shared/contexts/auth-snapshot';
import { ChatContextProvider } from '@/shared/contexts/chat';
import type { AuthSessionUserSnapshot } from '@/shared/types/auth-session';

export function ChatRouteShell({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: AuthSessionUserSnapshot | null;
}) {
  return (
    <AuthSnapshotProvider initialSnapshot={initialUser}>
      <ChatContextProvider>{children}</ChatContextProvider>
    </AuthSnapshotProvider>
  );
}
