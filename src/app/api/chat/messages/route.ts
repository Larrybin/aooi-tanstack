import { createChatMessagesPostAction } from '@/server/api/chat/create-handlers';

import { withApi } from '@/shared/lib/api/route';

import { chatHandlerRuntimeDeps } from '../handler-deps';

export const POST = withApi(createChatMessagesPostAction(chatHandlerRuntimeDeps));
