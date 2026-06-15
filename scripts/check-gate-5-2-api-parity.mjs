import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const TANSTACK_API_RUNTIME_FILES = [
  'apps/web/src/server/api-context.ts',
  'apps/web/src/server/cloudflare-bindings.ts',
];
const TANSTACK_SETTINGS_RUNTIME_FILES = [
  'apps/web/src/server/billing-runtime.ts',
];
const TANSTACK_PUBLIC_AI_RUNTIME_FILES = [
  ...TANSTACK_API_RUNTIME_FILES,
  ...TANSTACK_SETTINGS_RUNTIME_FILES,
  'apps/web/src/server/ai-runtime.ts',
  'apps/web/src/server/public-ui-config-runtime.ts',
];
const TANSTACK_CHAT_RUNTIME_FILES = [
  ...TANSTACK_PUBLIC_AI_RUNTIME_FILES,
  'apps/web/src/server/chat-api-runtime.ts',
];
const TANSTACK_EMAIL_RUNTIME_FILES = [
  ...TANSTACK_API_RUNTIME_FILES,
  ...TANSTACK_SETTINGS_RUNTIME_FILES,
  'apps/web/src/server/email-runtime.ts',
  'apps/web/src/server/permission-context.ts',
];
const TANSTACK_PERMISSION_RUNTIME_FILES = [
  ...TANSTACK_API_RUNTIME_FILES,
  'apps/web/src/server/permission-context.ts',
];
const TANSTACK_STORAGE_RUNTIME_FILES = [
  ...TANSTACK_API_RUNTIME_FILES,
  'apps/web/src/server/storage-runtime.ts',
];

const GATE_5_2_APIS = [
  {
    api: '/api/ai/query',
    legacyRoute: 'src/app/api/ai/query/route.ts',
    tanstackRoute: 'apps/web/src/routes/api/ai/query.ts',
    serverFiles: ['src/server/api/ai/query-route.ts'],
    runtimeFiles: TANSTACK_PUBLIC_AI_RUNTIME_FILES,
    legacyTests: ['src/app/api/ai/query/route.test.ts'],
  },
  {
    api: '/api/ai/generate',
    legacyRoute: 'src/app/api/ai/generate/route.ts',
    tanstackRoute: 'apps/web/src/routes/api/ai/generate.ts',
    serverFiles: ['src/server/api/ai/generate-route.ts'],
    runtimeFiles: TANSTACK_PUBLIC_AI_RUNTIME_FILES,
    legacyTests: ['src/app/api/ai/generate/route.test.ts'],
  },
  {
    api: '/api/ai/notify/$provider',
    legacyRoute: 'src/app/api/ai/notify/[provider]/route.ts',
    tanstackRoute: 'apps/web/src/routes/api/ai/notify/$provider.ts',
    serverFiles: ['src/server/api/ai/notify-route.ts'],
    runtimeFiles: TANSTACK_API_RUNTIME_FILES,
    legacyTests: [
      'src/app/api/ai/notify/[provider]/route.test.ts',
      'src/app/api/ai/notify-route.server.test.ts',
      'src/app/api/ai/notify/signature.server.test.ts',
    ],
  },
  {
    api: '/api/chat',
    legacyRoute: 'src/app/api/chat/route.ts',
    tanstackRoute: 'apps/web/src/routes/api/chat.ts',
    serverFiles: [
      'src/server/api/chat/create-handlers.ts',
      'src/server/api/chat/deps.ts',
    ],
    runtimeFiles: TANSTACK_CHAT_RUNTIME_FILES,
    legacyTests: [
      'src/app/api/chat/route.test.ts',
      'src/app/api/chat/create-handlers.test.ts',
    ],
  },
  {
    api: '/api/chat/info',
    legacyRoute: 'src/app/api/chat/info/route.ts',
    tanstackRoute: 'apps/web/src/routes/api/chat/info.ts',
    serverFiles: [
      'src/server/api/chat/create-handlers.ts',
      'src/server/api/chat/deps.ts',
    ],
    runtimeFiles: TANSTACK_CHAT_RUNTIME_FILES,
    legacyTests: ['src/app/api/chat/info/route.test.ts'],
  },
  {
    api: '/api/chat/list',
    legacyRoute: 'src/app/api/chat/list/route.ts',
    tanstackRoute: 'apps/web/src/routes/api/chat/list.ts',
    serverFiles: [
      'src/server/api/chat/create-handlers.ts',
      'src/server/api/chat/deps.ts',
    ],
    runtimeFiles: TANSTACK_CHAT_RUNTIME_FILES,
    legacyTests: ['src/app/api/chat/list/route.test.ts'],
  },
  {
    api: '/api/chat/messages',
    legacyRoute: 'src/app/api/chat/messages/route.ts',
    tanstackRoute: 'apps/web/src/routes/api/chat/messages.ts',
    serverFiles: [
      'src/server/api/chat/create-handlers.ts',
      'src/server/api/chat/deps.ts',
    ],
    runtimeFiles: TANSTACK_CHAT_RUNTIME_FILES,
    legacyTests: ['src/app/api/chat/messages/route.test.ts'],
  },
  {
    api: '/api/chat/new',
    legacyRoute: 'src/app/api/chat/new/route.ts',
    tanstackRoute: 'apps/web/src/routes/api/chat/new.ts',
    serverFiles: [
      'src/server/api/chat/create-handlers.ts',
      'src/server/api/chat/deps.ts',
    ],
    runtimeFiles: TANSTACK_CHAT_RUNTIME_FILES,
    legacyTests: ['src/app/api/chat/new/route.test.ts'],
  },
  {
    api: '/api/email/send-email',
    legacyRoute: 'src/app/api/email/send-email/route.ts',
    tanstackRoute: 'apps/web/src/routes/api/email/send-email.ts',
    serverFiles: ['src/server/api/email/send-email-route.ts'],
    runtimeFiles: TANSTACK_EMAIL_RUNTIME_FILES,
    legacyTests: ['src/app/api/email/send-email/route.test.ts'],
  },
  {
    api: '/api/email/test',
    legacyRoute: 'src/app/api/email/test/route.ts',
    tanstackRoute: 'apps/web/src/routes/api/email/test.ts',
    serverFiles: ['src/server/api/email/test-route.ts'],
    runtimeFiles: TANSTACK_EMAIL_RUNTIME_FILES,
    legacyTests: ['src/app/api/email/test/route.test.ts'],
  },
  {
    api: '/api/email/verify-code',
    legacyRoute: 'src/app/api/email/verify-code/route.ts',
    tanstackRoute: 'apps/web/src/routes/api/email/verify-code.ts',
    serverFiles: ['src/server/api/email/verify-code-route.ts'],
    runtimeFiles: TANSTACK_PERMISSION_RUNTIME_FILES,
    legacyTests: ['src/app/api/email/verify-code/route.test.ts'],
  },
  {
    api: '/api/storage/upload-image',
    legacyRoute: 'src/app/api/storage/upload-image/route.ts',
    tanstackRoute: 'apps/web/src/routes/api/storage/upload-image.ts',
    serverFiles: ['src/server/api/storage/upload-image-route.ts'],
    runtimeFiles: TANSTACK_STORAGE_RUNTIME_FILES,
    legacyTests: ['src/app/api/storage/upload-image/route.test.ts'],
  },
];

const args = process.argv.slice(2);
const requestedApis = new Set();
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--api') {
    const value = args[index + 1];
    if (!value) throw new Error('--api requires a value');
    requestedApis.add(value);
    index += 1;
    continue;
  }
  if (arg.startsWith('--api=')) {
    requestedApis.add(arg.slice('--api='.length));
    continue;
  }
  throw new Error(`unknown argument: ${arg}`);
}

const selected = requestedApis.size
  ? GATE_5_2_APIS.filter((entry) => requestedApis.has(entry.api))
  : GATE_5_2_APIS;

const unknownApis = [...requestedApis].filter(
  (api) => !GATE_5_2_APIS.some((entry) => entry.api === api)
);
if (unknownApis.length > 0) {
  throw new Error(`unknown Gate 5.2 API(s): ${unknownApis.join(', ')}`);
}

const failures = [];

function repoPath(filePath) {
  return path.resolve(root, filePath);
}

function fileExists(filePath) {
  return existsSync(repoPath(filePath));
}

function readFile(filePath) {
  return readFileSync(repoPath(filePath), 'utf8');
}

function checkExists(filePath, label, api) {
  if (!fileExists(filePath)) {
    failures.push(`${api}: missing ${label}: ${filePath}`);
  }
}

const forbiddenRuntimePatterns = [
  { label: 'src/app import', pattern: /['"]@\/app\// },
  { label: 'src/app path', pattern: /src\/app\// },
  { label: 'next import', pattern: /['"]next\// },
  { label: 'next-intl import', pattern: /['"]next-intl(?:\/|['"])/ },
  { label: 'settings-runtime.query', pattern: /settings-runtime\.query/ },
  { label: 'next-cache', pattern: /next-cache/ },
];

function checkRuntimeFile(filePath, api) {
  if (!fileExists(filePath)) return;
  const source = readFile(filePath);
  for (const { label, pattern } of forbiddenRuntimePatterns) {
    if (pattern.test(source)) {
      failures.push(`${api}: forbidden ${label} in ${filePath}`);
    }
  }
}

function checkServerFile(filePath, api) {
  checkRuntimeFile(filePath, api);
  if (!fileExists(filePath)) return;
  const source = readFile(filePath);
  if (/apps\/web\//.test(source)) {
    failures.push(
      `${api}: src/server/api file imports apps/web in ${filePath}`
    );
  }
}

for (const entry of selected) {
  checkExists(entry.legacyRoute, 'legacy route', entry.api);
  checkExists(entry.tanstackRoute, 'TanStack route', entry.api);

  for (const serverFile of entry.serverFiles) {
    checkExists(serverFile, 'server API core/factory', entry.api);
    checkServerFile(serverFile, entry.api);
  }

  checkRuntimeFile(entry.tanstackRoute, entry.api);
  for (const runtimeFile of entry.runtimeFiles ?? []) {
    checkExists(runtimeFile, 'TanStack runtime helper', entry.api);
    checkRuntimeFile(runtimeFile, entry.api);
  }

  for (const legacyTest of entry.legacyTests) {
    if (fileExists(legacyTest)) {
      failures.push(
        `${entry.api}: legacy test still owns migrated API: ${legacyTest}`
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Gate 5.2 API parity check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Gate 5.2 API parity check passed for ${selected.length} API route(s).`
);
