import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPaymentAmountCents } from './format-money';

test('formatPaymentAmountCents preserves existing currency prefixes', () => {
  assert.equal(formatPaymentAmountCents(1234, 'USD'), '$12.34');
  assert.equal(formatPaymentAmountCents(1234, 'EUR'), '€12.34');
  assert.equal(formatPaymentAmountCents(1234, 'CNY'), '¥12.34');
  assert.equal(formatPaymentAmountCents(1234, 'GBP'), 'GBP 12.34');
});

test('formatPaymentAmountCents defaults missing values to USD zero', () => {
  assert.equal(formatPaymentAmountCents(null, null), '$0');
  assert.equal(formatPaymentAmountCents(undefined, ''), '$0');
});
