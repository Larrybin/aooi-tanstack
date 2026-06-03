import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

function readHookInput() {
  const raw = readFileSync(0, 'utf8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function block(reason) {
  process.stdout.write(`${JSON.stringify({ decision: 'block', reason })}\n`);
}

function runGit(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function readTail(path, maxBytes = 1_000_000) {
  if (!path || !existsSync(path)) return '';

  const content = readFileSync(path, 'utf8');
  if (content.length <= maxBytes) return content;
  return content.slice(content.length - maxBytes);
}

function extractPatchPaths(text) {
  const paths = new Set();
  const pattern =
    /^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm;

  for (const match of text.matchAll(pattern)) {
    paths.add((match[1] || match[2]).trim());
  }

  return [...paths];
}

function getChangedFiles(transcriptText) {
  const transcriptPaths = extractPatchPaths(transcriptText);
  if (transcriptPaths.length > 0) return transcriptPaths;

  const diffFiles = runGit(['diff', '--name-only'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return diffFiles;
}

function isDocsOnlyPath(file) {
  return (
    file === 'README.md' ||
    file === 'AGENTS.md' ||
    file.startsWith('docs/') ||
    /\.md$/.test(file)
  );
}

function isCodeOrConfigPath(file) {
  if (isDocsOnlyPath(file)) return false;
  return /\.(?:[cm]?[tj]sx?|json|cjs|mjs|sql)$/.test(file);
}

function isI18nPath(file) {
  if (isDocsOnlyPath(file)) return false;
  return (
    /(?:^|\/)(?:i18n|locale|messages)(?:\/|\.|-)/i.test(file) ||
    /^sites\/[^/]+\/content\//.test(file) ||
    /^sites\/[^/]+\/i18n\//.test(file) ||
    /^content\//.test(file)
  );
}

function isCloudflarePath(file) {
  if (isDocsOnlyPath(file)) return false;
  return (
    file.startsWith('cloudflare/') ||
    /(?:^|\/)(?:wrangler|cloudflare|cf-|run-cf|deploy\.settings|deploy\.preview\.settings|worker)/i.test(
      file
    )
  );
}

function hasAnyEvidence(text) {
  return /\b(?:pnpm\s+(?:test|lint|arch:check|build|cf:check|cf:build|cf:typegen(?::check)?|i18n:check)|node\s+--(?:test|check)|npm\s+test)\b/.test(
    text
  );
}

function hasI18nEvidence(text) {
  return /\bpnpm\s+i18n:check\b[\s\S]*--strict|--strict[\s\S]*\bpnpm\s+i18n:check\b/.test(
    text
  );
}

function hasSiteBuildEvidence(text) {
  return /\bSITE\s*=\s*[\w-]+\s+pnpm\s+build\b|\bpnpm\s+build\b[\s\S]*\bSITE\s*=\s*[\w-]+/.test(
    text
  );
}

function hasCloudflareEvidence(text) {
  return /\bpnpm\s+(?:cf:check|cf:build|cf:build:no-db|cf:typegen:check)\b/.test(
    text
  );
}

function latestUserAskedForGitDelivery(text) {
  return /(?:开\s*pr|開\s*pr|pull request|提交并推送|提交.*推送|commit.*push|push.*pr|create.*pr)/i.test(
    text
  );
}

function hasGitDeliveryEvidence(text) {
  return /(?:git\s+commit|git\s+push|create_pull_request|_create_pull_request|::git-commit|::git-push|::git-create-pr|https:\/\/github\.com\/[^\s)]+\/pull\/\d+)/i.test(
    text
  );
}

const input = readHookInput();
const transcriptText = readTail(input.transcript_path);
const assistantText = input.last_assistant_message || '';
const evidenceText = `${transcriptText}\n${assistantText}`;
const changedFiles = getChangedFiles(transcriptText);

if (changedFiles.length === 0) {
  process.exit(0);
}

const docsOnly = changedFiles.every(isDocsOnlyPath);
const codeOrConfigChanged = changedFiles.some(isCodeOrConfigPath);
const i18nChanged = changedFiles.some(isI18nPath);
const cloudflareChanged = changedFiles.some(isCloudflarePath);

if (
  i18nChanged &&
  (!hasI18nEvidence(evidenceText) || !hasSiteBuildEvidence(evidenceText))
) {
  block(
    'i18n/content changes need strict i18n check and selected site build evidence before finalizing.'
  );
  process.exit(0);
}

if (cloudflareChanged && !hasCloudflareEvidence(evidenceText)) {
  block(
    'Cloudflare/deploy/worker changes need cf check/build/typegen evidence before finalizing.'
  );
  process.exit(0);
}

if (!docsOnly && codeOrConfigChanged && !hasAnyEvidence(evidenceText)) {
  block(
    'Code or config changed without verification evidence. Run the smallest relevant verification before finalizing.'
  );
  process.exit(0);
}

if (
  latestUserAskedForGitDelivery(transcriptText) &&
  !hasGitDeliveryEvidence(evidenceText)
) {
  block(
    'The user asked for commit/push/PR delivery. Complete that git delivery or explain the blocker before finalizing.'
  );
}
