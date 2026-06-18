'use client';

import type { ReactNode } from 'react';

import { AuthSnapshotProvider } from '@/shared/contexts/auth-snapshot';
import { ChatContextProvider } from '@/shared/contexts/chat';
import { SidebarProvider } from '@/shared/components/ui/sidebar';
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
      <SidebarProvider>
        <ChatContextProvider>{children}</ChatContextProvider>
      </SidebarProvider>
    </AuthSnapshotProvider>
  );
}
