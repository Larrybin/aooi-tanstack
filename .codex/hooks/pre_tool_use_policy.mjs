import { readFileSync } from 'node:fs';

function readHookInput() {
  const raw = readFileSync(0, 'utf8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writePreToolOutput(output) {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        ...output,
      },
    })}\n`
  );
}

function deny(reason) {
  writePreToolOutput({
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  });
}

function addContext(messages) {
  writePreToolOutput({
    additionalContext: messages.join('\n'),
  });
}

function commandMatches(command, pattern) {
  return pattern.test(command);
}

function hasExplicitSite(command) {
  return /\bSITE\s*=|--site(?:=|\s+)/.test(command);
}

function handleBash(command) {
  const denyRules = [
    {
      pattern: /\bgit\s+reset\s+--hard(?:\s|$)/,
      reason:
        'Blocked git reset --hard. Do not discard local work from this hook.',
    },
    {
      pattern: /\bgit\s+clean\s+-(?:fdx?|dfx?)(?:\s|$)/,
      reason:
        'Blocked git clean -fd/-fdx. Do not delete untracked work from this hook.',
    },
    {
      pattern:
        /\bgit\s+push\b[^\n;&|]*\s(?:--force|--force-with-lease|-f)(?:[=\s]|$)/,
      reason:
        'Blocked force push. Push only non-destructive refs unless the user explicitly approves outside this hook.',
    },
    {
      pattern: /\bgit\s+branch\b[^\n;&|]*\s-D(?:\s|$)/,
      reason:
        'Blocked git branch -D. Audit branches before destructive deletion.',
    },
    {
      pattern:
        /\bgit\s+branch\b[^\n;&|]*\s-d\s+\$\(|\bgit\s+branch\b[^\n;&|]*\|\s*xargs\b/,
      reason:
        'Blocked bulk branch deletion. Audit branches before deleting them.',
    },
    {
      pattern: /\brm\s+-[^\s;&|]*r[^\s;&|]*f|\brm\s+-[^\s;&|]*f[^\s;&|]*r/,
      reason:
        'Blocked rm -rf. Use targeted file edits and preserve unrelated work.',
    },
    {
      pattern: /\bpnpm\s+(?:run\s+)?release:cf\b/,
      reason:
        'Blocked production Cloudflare release. Provide a release checklist; a local operator must run this explicitly.',
    },
    {
      pattern: /\bpnpm\s+(?:run\s+)?cf:deploy(?::(?:state|app))?(?:\s|$)/,
      reason:
        'Blocked Cloudflare deploy command. Codex hooks allow checks, not production deploys.',
    },
    {
      pattern: /\bwrangler\s+deploy\b/,
      reason:
        'Blocked wrangler deploy. Use aooi release/check flows and keep production deploys operator-owned.',
    },
    {
      pattern: /\bpnpm\s+(?:run\s+)?db:push\b/,
      reason:
        'Blocked db:push. Use generated migrations and reviewed migration flows.',
    },
  ];

  for (const rule of denyRules) {
    if (commandMatches(command, rule.pattern)) {
      deny(rule.reason);
      return;
    }
  }

  if (
    /\bpnpm\s+(?:run\s+)?db:migrate\b/.test(command) &&
    /\b(?:NODE_ENV\s*=\s*production|PRODUCTION_DATABASE_URL|\.env\.production|production)\b/i.test(
      command
    )
  ) {
    deny(
      'Blocked production db:migrate. Production migrations are release-operator work.'
    );
    return;
  }

  const messages = [];

  if (
    /\bpnpm\s+(?:run\s+)?build\b/.test(command) &&
    !hasExplicitSite(command)
  ) {
    messages.push(
      'aooi is a multi-site repo. Prefer SITE=<site-key> pnpm build for site-scoped build evidence.'
    );
  }

  if (
    /\bpnpm\s+(?:run\s+)?cf:(?:check|build|typegen(?::check)?)\b/.test(
      command
    ) &&
    !hasExplicitSite(command)
  ) {
    messages.push(
      'Cloudflare commands should normally keep SITE=<site-key> explicit unless the script is intentionally running a matrix.'
    );
  }

  if (messages.length > 0) {
    addContext(messages);
  }
}

function isGeneratedPath(repoPath) {
  return /^(?:\.\/)?(?:\.next|\.open-next|dist|build|output)\//.test(repoPath);
}

function isProductionRuntimePath(repoPath) {
  if (!/^(?:src|cloudflare)\//.test(repoPath)) return false;
  if (/\.(?:test|spec)\.[cm]?[tj]sx?$/.test(repoPath)) return false;
  return /\.(?:[cm]?[tj]sx?)$/.test(repoPath);
}

const processEnvAllowlist = new Set([
  'cloudflare/workers/create-server-worker.ts',
  'src/config/env-contract.ts',
  'src/config/load-dotenv.ts',
  'src/config/public-env.ts',
  'src/config/server-auth-base-url.ts',
  'src/infra/adapters/db/config.ts',
  'src/infra/runtime/env.server.ts',
]);

function parsePatchFiles(patch) {
  const files = [];
  let current = null;

  for (const line of patch.split('\n')) {
    const fileMatch = line.match(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/);
    if (fileMatch) {
      current = {
        path: fileMatch[1].trim(),
        addedLines: [],
      };
      files.push(current);
      continue;
    }

    const moveMatch = line.match(/^\*\*\* Move to: (.+)$/);
    if (moveMatch && current) {
      current.path = moveMatch[1].trim();
      continue;
    }

    if (current && line.startsWith('+') && !line.startsWith('+++')) {
      current.addedLines.push(line.slice(1));
    }
  }

  return files;
}

function importsTestingLayer(line) {
  return /(?:(?:from|import\s*\()\s*['"][^'"]*(?:src\/testing|@\/testing|(?:\.\.?\/)+testing)(?:\/[^'"]*)?['"])/.test(
    line
  );
}

function handlePatch(patch) {
  const files = parsePatchFiles(patch);
  const messages = [];
  let schemaChanged = false;
  let migrationChanged = false;

  for (const file of files) {
    if (isGeneratedPath(file.path)) {
      deny(`Blocked edit to generated artifact: ${file.path}`);
      return;
    }

    if (file.path === 'src/config/db/schema.ts') {
      schemaChanged = true;
    }
    if (/^src\/config\/db\/migrations\//.test(file.path)) {
      migrationChanged = true;
    }

    if (!isProductionRuntimePath(file.path)) continue;

    for (const addedLine of file.addedLines) {
      if (importsTestingLayer(addedLine)) {
        deny(`Blocked production import of src/testing in ${file.path}.`);
        return;
      }

      if (
        /\bprocess\.env\b/.test(addedLine) &&
        !processEnvAllowlist.has(file.path)
      ) {
        messages.push(
          `${file.path} added process.env usage. Keep runtime env access behind src/config/env-contract.ts and verify with pnpm lint or pnpm arch:check.`
        );
      }
    }
  }

  if (schemaChanged && !migrationChanged) {
    messages.push(
      'src/config/db/schema.ts changed without a migration in the same patch. Add or verify migrations before shipping.'
    );
  }

  if (messages.length > 0) {
    addContext([...new Set(messages)]);
  }
}

const input = readHookInput();
const toolName = input.tool_name || '';
const command = input.tool_input?.command || '';

if (toolName === 'Bash' && typeof command === 'string') {
  handleBash(command);
} else if (
  (toolName === 'apply_patch' || toolName === 'Edit' || toolName === 'Write') &&
  typeof command === 'string'
) {
  handlePatch(command);
}
