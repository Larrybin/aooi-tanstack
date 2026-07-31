import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CalculatorHome } from './401k-calculator-home';
import { resolveCalculatorHomeCopy } from './401k-calculator-home-copy';

const copy = resolveCalculatorHomeCopy(
  {
    en: JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'sites/401k-calculator/content/home.en.json'),
        'utf8'
      )
    ),
  },
  'en'
);

test('calculator home restores the projection chart and input guidance', () => {
  const html = renderToStaticMarkup(<CalculatorHome copy={copy} locale="en" />);

  assert.match(html, /aria-label="Balance over time"/);
  assert.equal(html.match(/data-projection-milestone=/g)?.length, 9);
  assert.match(html, /Age 36/);
  assert.match(html, /Age 67/);
  assert.match(html, /What each 401\(k\) input means/);
  assert.match(html, /Scenario reminder/);
});
