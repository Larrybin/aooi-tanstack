import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatGroupsAsCsv,
  formatGroupsAsText,
  parseNames,
  splitNames,
} from './groups';

const keepOrder = () => 0.999_999;

test('parseNames accepts comma and newline separated rosters', () => {
  assert.deepEqual(parseNames(' Ava, Ben \n\nCamila,\n Devon '), [
    'Ava',
    'Ben',
    'Camila',
    'Devon',
  ]);
});

test('group-count mode distributes leftovers one at a time', () => {
  const groups = splitNames({
    names: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    mode: 'groups',
    count: 3,
    random: keepOrder,
  });

  assert.deepEqual(groups, [
    ['A', 'D', 'G'],
    ['B', 'E'],
    ['C', 'F'],
  ]);
});

test('group-count mode never creates empty groups', () => {
  const groups = splitNames({
    names: ['A', 'B'],
    mode: 'groups',
    count: 99,
    random: keepOrder,
  });

  assert.deepEqual(groups, [['A'], ['B']]);
});

test('group-size mode keeps each full group at the requested size', () => {
  const groups = splitNames({
    names: ['A', 'B', 'C', 'D', 'E'],
    mode: 'size',
    count: 2,
    random: keepOrder,
  });

  assert.deepEqual(groups, [['A', 'B'], ['C', 'D'], ['E']]);
});

test('group-size mode preserves the smaller final group from the source tool', () => {
  const groups = splitNames({
    names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    mode: 'size',
    count: 4,
    random: keepOrder,
  });

  assert.deepEqual(groups, [
    ['A', 'B', 'C', 'D'],
    ['E', 'F', 'G', 'H'],
    ['I', 'J'],
  ]);
});

test('splitNames requires at least two names', () => {
  assert.throws(
    () =>
      splitNames({
        names: ['A'],
        mode: 'groups',
        count: 2,
        random: keepOrder,
      }),
    /at least two names/
  );
});

test('plain-text and CSV exports preserve group labels and escape names', () => {
  const groups = [['Ava', 'Ben, Jr.'], ['"Camila"']];

  assert.equal(
    formatGroupsAsText(groups, 'Team'),
    'Team 1 (2)\n- Ava\n- Ben, Jr.\n\nTeam 2 (1)\n- "Camila"'
  );
  assert.equal(
    formatGroupsAsCsv(groups, 'Team'),
    '"Group","Position","Name"\n' +
      '"Team 1","1","Ava"\n' +
      '"Team 1","2","Ben, Jr."\n' +
      '"Team 2","1","""Camila"""'
  );
});

test('CSV exports neutralize spreadsheet formulas in user-controlled names', () => {
  assert.equal(
    formatGroupsAsCsv(
      [['=HYPERLINK("https://example.com")', '+SUM(1,1)']],
      'Team'
    ),
    '"Group","Position","Name"\n' +
      '"Team 1","1","\'=HYPERLINK(""https://example.com"")"\n' +
      '"Team 1","2","\'+SUM(1,1)"'
  );
});
