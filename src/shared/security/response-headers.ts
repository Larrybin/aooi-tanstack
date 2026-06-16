export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://www.clarity.ms https://scripts.simpleanalyticscdn.com https://plausible.io https://openpanel.dev https://embed.tawk.to https://client.crisp.chat https://*.adsterra.com https://*.highperformanceformat.com https://*.highcpmrevenuenetwork.com",
  "script-src-elem 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://www.clarity.ms https://scripts.simpleanalyticscdn.com https://plausible.io https://openpanel.dev https://embed.tawk.to https://client.crisp.chat https://*.adsterra.com https://*.highperformanceformat.com https://*.highcpmrevenuenetwork.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://client.crisp.chat",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com https://client.crisp.chat",
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.clarity.ms https://*.clarity.ms https://plausible.io https://openpanel.dev https://client.crisp.chat wss://client.relay.crisp.chat https://embed.tawk.to wss://*.tawk.to",
  "frame-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com https://vars.hotjar.com https://embed.tawk.to https://client.crisp.chat",
  "form-action 'self'",
].join('; ');

export function applySecurityHeadersToHeaders(headers: Headers): void {
  headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
}
