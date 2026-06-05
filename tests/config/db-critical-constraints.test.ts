import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rootDir = process.cwd();
const schemaSource = readFileSync(
  path.join(rootDir, 'src', 'config', 'db', 'schema.ts'),
  'utf8'
);
const migrationSql = readdirSync(
  path.join(rootDir, 'src', 'config', 'db', 'migrations')
)
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort()
  .map((fileName) =>
    readFileSync(
      path.join(rootDir, 'src', 'config', 'db', 'migrations', fileName),
      'utf8'
    )
  )
  .join('\n');

test('database schema keeps payment webhook idempotency constraints', () => {
  assert.match(
    schemaSource,
    /uniqueIndex\('uq_payment_webhook_audit_provider_digest'\)\.on\(\s*table\.provider,\s*table\.rawDigest\s*\)/
  );
  assert.match(
    schemaSource,
    /uniqueIndex\('uq_payment_webhook_inbox_provider_digest'\)\.on\(\s*table\.provider,\s*table\.rawDigest\s*\)/
  );
  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "uq_payment_webhook_audit_provider_digest" ON "payment_webhook_audit" USING btree \("provider","raw_digest"\)/
  );
  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "uq_payment_webhook_inbox_provider_digest" ON "payment_webhook_inbox" USING btree \("provider","raw_digest"\)/
  );
});

test('database schema keeps entitlement and quota lookup constraints', () => {
  assert.match(
    schemaSource,
    /index\('idx_entitlement_grant_user_scope'\)\.on\(\s*table\.userId,\s*table\.siteKey,\s*table\.productKey,\s*table\.environment,\s*table\.status\s*\)/
  );
  assert.match(
    schemaSource,
    /uniqueIndex\('uq_product_quota_idempotency'\)\.on\(table\.idempotencyKey\)/
  );
  assert.match(
    migrationSql,
    /CREATE INDEX "idx_entitlement_grant_user_scope" ON "entitlement_grant" USING btree \("user_id","site_key","product_key","environment","status"\)/
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "uq_product_quota_idempotency" UNIQUE\("idempotency_key"\)/
  );
});
