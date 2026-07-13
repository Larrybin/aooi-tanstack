export const RUNTIME_PARITY_IGNORED_HEADERS = [
  'connection',
  'keep-alive',
  'content-encoding',
  'date',
  'x-request-id',
  'x-vercel-id',
  'cf-ray',
] as const;
const RUNTIME_PARITY_IGNORED_HEADER_SET: ReadonlySet<string> = new Set(
  RUNTIME_PARITY_IGNORED_HEADERS
);

const RUNTIME_PARITY_CUSTOM_HEADERS = new Set([
  'cache-control',
  'content-type',
  'location',
  'set-cookie',
]);

type RuntimeParityCookieSummary = {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string | null;
  clearsCookie: boolean;
};

export type RuntimeParityResponseSummary = {
  status: number;
  cacheControl: string | null;
  contentType: string | null;
  location: string | null;
  headers: Record<string, string>;
  setCookieHeaderCount: number;
  cookies: RuntimeParityCookieSummary[];
  setCookiePresent: boolean;
  clearsCookie: boolean;
};

export type RuntimeParityResult = {
  status: 'passed' | 'failed';
  detail: string;
  mismatches: string[];
};

function contentTypeFingerprint(contentType: string | null): string | null {
  return contentType?.split(';')[0]?.trim().toLowerCase() || null;
}

function normalizeLocationFingerprint(location: string | null): string | null {
  if (!location) {
    return null;
  }

  try {
    const parsed = new URL(location, 'https://runtime-parity.invalid');
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return location;
  }
}

function cookieSecurityFingerprint(
  cookies: RuntimeParityCookieSummary[]
): string | null {
  if (cookies.length === 0) {
    return null;
  }

  return cookies
    .map((cookie) =>
      [
        cookie.name,
        `httpOnly=${cookie.httpOnly ? 'yes' : 'no'}`,
        `secure=${cookie.secure ? 'yes' : 'no'}`,
        `sameSite=${cookie.sameSite || 'none'}`,
        `clear=${cookie.clearsCookie ? 'yes' : 'no'}`,
      ].join(' ')
    )
    .sort()
    .join(' | ');
}

function buildComparableHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const comparableHeaders: Record<string, string> = {};

  for (const [rawName, rawValue] of Object.entries(headers)) {
    const name = rawName.toLowerCase();
    if (RUNTIME_PARITY_IGNORED_HEADER_SET.has(name)) {
      continue;
    }
    if (RUNTIME_PARITY_CUSTOM_HEADERS.has(name)) {
      continue;
    }

    comparableHeaders[name] = rawValue;
  }

  return comparableHeaders;
}

function readPrimaryResponse(
  responses: RuntimeParityResponseSummary[]
): RuntimeParityResponseSummary | null {
  return responses[0] ?? null;
}

export function compareRuntimeResponseContracts({
  label,
  baselineName,
  candidateName,
  baselineResponses,
  candidateResponses,
}: {
  label: string;
  baselineName: string;
  candidateName: string;
  baselineResponses: RuntimeParityResponseSummary[];
  candidateResponses: RuntimeParityResponseSummary[];
}): RuntimeParityResult {
  const baseline = readPrimaryResponse(baselineResponses);
  const candidate = readPrimaryResponse(candidateResponses);
  const mismatches: string[] = [];

  if (!baseline && !candidate) {
    return {
      status: 'passed',
      detail: `${label} matched`,
      mismatches,
    };
  }

  if (!baseline || !candidate) {
    mismatches.push(`${label} response count mismatch`);
  } else {
    if (baseline.status !== candidate.status) {
      mismatches.push(
        `${label} status mismatch: ${baselineName}=${baseline.status} ${candidateName}=${candidate.status}`
      );
    }

    if (baseline.cacheControl !== candidate.cacheControl) {
      mismatches.push(
        `${label} cache-control mismatch: ${baselineName}=${baseline.cacheControl || 'n/a'} ${candidateName}=${candidate.cacheControl || 'n/a'}`
      );
    }

    const baselineContentType = contentTypeFingerprint(baseline.contentType);
    const candidateContentType = contentTypeFingerprint(candidate.contentType);
    if (baselineContentType !== candidateContentType) {
      mismatches.push(
        `${label} content-type mismatch: ${baselineName}=${baselineContentType || 'n/a'} ${candidateName}=${candidateContentType || 'n/a'}`
      );
    }

    const baselineLocation = normalizeLocationFingerprint(baseline.location);
    const candidateLocation = normalizeLocationFingerprint(candidate.location);
    if (baselineLocation !== candidateLocation) {
      mismatches.push(
        `${label} location mismatch: ${baselineName}=${baselineLocation || 'n/a'} ${candidateName}=${candidateLocation || 'n/a'}`
      );
    }

    if (baseline.setCookiePresent !== candidate.setCookiePresent) {
      mismatches.push(
        `${label} set-cookie presence mismatch: ${baselineName}=${baseline.setCookiePresent ? 'yes' : 'no'} ${candidateName}=${candidate.setCookiePresent ? 'yes' : 'no'}`
      );
    }

    if (baseline.setCookieHeaderCount !== candidate.setCookieHeaderCount) {
      mismatches.push(
        `${label} set-cookie count mismatch: ${baselineName}=${baseline.setCookieHeaderCount} ${candidateName}=${candidate.setCookieHeaderCount}`
      );
    }

    if (baseline.clearsCookie !== candidate.clearsCookie) {
      mismatches.push(
        `${label} clear-cookie mismatch: ${baselineName}=${baseline.clearsCookie ? 'yes' : 'no'} ${candidateName}=${candidate.clearsCookie ? 'yes' : 'no'}`
      );
    }

    const baselineCookieFingerprint = cookieSecurityFingerprint(
      baseline.cookies
    );
    const candidateCookieFingerprint = cookieSecurityFingerprint(
      candidate.cookies
    );
    if (baselineCookieFingerprint !== candidateCookieFingerprint) {
      mismatches.push(
        `${label} cookie security mismatch: ${baselineName}=${baselineCookieFingerprint || 'n/a'} ${candidateName}=${candidateCookieFingerprint || 'n/a'}`
      );
    }

    const baselineHeaders = buildComparableHeaders(baseline.headers);
    const candidateHeaders = buildComparableHeaders(candidate.headers);
    const headerNames = new Set([
      ...Object.keys(baselineHeaders),
      ...Object.keys(candidateHeaders),
    ]);

    for (const headerName of headerNames) {
      if (baselineHeaders[headerName] !== candidateHeaders[headerName]) {
        mismatches.push(
          `${label} header "${headerName}" mismatch: ${baselineName}=${baselineHeaders[headerName] || 'n/a'} ${candidateName}=${candidateHeaders[headerName] || 'n/a'}`
        );
      }
    }
  }

  if (mismatches.length === 0) {
    return {
      status: 'passed',
      detail: `${label} matched`,
      mismatches,
    };
  }

  return {
    status: 'failed',
    detail: mismatches.join('; '),
    mismatches,
  };
}
