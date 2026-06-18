'use client';

import type { ReactNode } from 'react';
import { ChatLibrary } from '@/domains/chat/ui/library';

import { WorkspaceLayout } from '@/shared/blocks/workspace';
import { AuthSnapshotProvider } from '@/shared/contexts/auth-snapshot';
import { ChatContextProvider } from '@/shared/contexts/chat';
import type { AuthSessionUserSnapshot } from '@/shared/types/auth-session';
import type { Sidebar } from '@/shared/types/blocks/workspace';

export function ChatRouteShell({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: AuthSessionUserSnapshot | null;
}) {
  const sidebar: Sidebar = {
    library: <ChatLibrary />,
    user: {
      show_email: false,
      show_signout: true,
      signout_callback: '/chat',
      signin_callback: '/chat',
    },
    variant: 'sidebar',
  };

  return (
    <AuthSnapshotProvider initialSnapshot={initialUser}>
      <ChatContextProvider>
        <WorkspaceLayout sidebar={sidebar} initialUser={initialUser}>
          {children}
        </WorkspaceLayout>
      </ChatContextProvider>
    </AuthSnapshotProvider>
  );
}
