import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cleanLetters,
  formatAnagramResultsAsText,
  generateAnagrams,
  groupAnagramResults,
} from './anagrams';

const defaultOptions = {
  dictionary: 'common' as const,
  maxWords: 5,
  minLength: 2,
  mustInclude: '',
  excludeWords: '',
  limit: 200,
};

test('cleanLetters normalizes case, spaces, and punctuation to ASCII letters', () => {
  assert.equal(cleanLetters(' Race! 123 À '), 'race');
  assert.equal(cleanLetters('LISTEN up'), 'listenup');
});

test('single-word results preserve source filtering and source sort order', () => {
  assert.deepEqual(
    generateAnagrams('race', { ...defaultOptions, maxWords: 1 }),
    ['acre', 'care', 'ace', 'arc', 'are', 'era']
  );
});

test('known source phrases remain available without revising their wording', () => {
  assert.ok(
    generateAnagrams('listen up', defaultOptions).includes('silent up')
  );
  assert.ok(
    generateAnagrams('dormitory', defaultOptions).includes('riot do my')
  );
  assert.ok(generateAnagrams('stare at', defaultOptions).includes('tear sats'));
});

test('include and exclude filters use the source normalized matching semantics', () => {
  assert.deepEqual(
    generateAnagrams('race', {
      ...defaultOptions,
      maxWords: 1,
      mustInclude: 'AR',
      excludeWords: 'arc',
    }),
    ['care', 'are']
  );
});

test('minimum length, maximum words, and result limits are enforced', () => {
  const results = generateAnagrams('stare at', {
    ...defaultOptions,
    minLength: 3,
    maxWords: 2,
    limit: 4,
  });

  assert.equal(results.length, 4);
  assert.ok(results.every((result) => result.split(/\s+/u).length <= 2));
  assert.ok(
    generateAnagrams('stare at', {
      ...defaultOptions,
      minLength: 5,
      maxWords: 1,
    }).every((result) => result.length >= 5)
  );
});

test('games mode limits phrase candidates to words no longer than eight letters', () => {
  const common = generateAnagrams('dormitory my', {
    ...defaultOptions,
    maxWords: 2,
  });
  const games = generateAnagrams('dormitory my', {
    ...defaultOptions,
    dictionary: 'games',
    maxWords: 2,
  });

  assert.ok(common.includes('dormitory my'));
  assert.ok(!games.includes('dormitory my'));
});

test('generated phrases are de-duplicated and preserve source ordering', () => {
  const results = generateAnagrams('stare at', defaultOptions);

  assert.equal(new Set(results).size, results.length);
  assert.deepEqual(results.slice(0, 4), ['rates', 'stare', 'state', 'taste']);
});

test('empty, punctuation-only, and unmatched input return no results', () => {
  assert.deepEqual(generateAnagrams('', defaultOptions), []);
  assert.deepEqual(generateAnagrams('!!!', defaultOptions), []);
  assert.deepEqual(generateAnagrams('qqq', defaultOptions), []);
});

test('results group by word count and preserve group result order', () => {
  assert.deepEqual(groupAnagramResults(['race', 'care', 'dirty room']), [
    { label: '1 word', results: ['race', 'care'] },
    { label: '2 words', results: ['dirty room'] },
  ]);
});

test('TXT export matches the recovered source format', () => {
  assert.equal(
    formatAnagramResultsAsText(' stare at ', ['state', 'star eat']),
    [
      'Anagram Generator Results',
      'Input: stare at',
      '',
      'state',
      'star eat',
      '',
      'Review results before using them in a game or puzzle.',
    ].join('\n')
  );
});
