import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('product home renders its site-provided skip link before the site header', () => {
  const viewSource = readFileSync(
    resolve(process.cwd(), 'src/surfaces/landing/home/home.view.tsx'),
    'utf8'
  );
  const calculatorHomeSource = readFileSync(
    resolve(process.cwd(), 'sites/401k-calculator/home.tsx'),
    'utf8'
  );

  const skipLinkIndex = viewSource.indexOf('href="#calculator"');
  const shellIndex = viewSource.indexOf('<LandingShellView');

  assert.notEqual(skipLinkIndex, -1);
  assert.ok(skipLinkIndex < shellIndex);
  assert.match(viewSource, /getSiteProductHomeSkipLink\(data\.productHome\)/);
  assert.match(
    calculatorHomeSource,
    /return productHome\.copy\.shell\.skipToCalculator/
  );
});
