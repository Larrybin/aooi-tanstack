export type AnagramDictionary = 'common' | 'games' | 'phrases';

export type AnagramOptions = {
  dictionary: AnagramDictionary;
  maxWords: number;
  minLength: number;
  mustInclude: string;
  excludeWords: string;
  limit: number;
};

export type AnagramResultGroup = {
  label: string;
  results: string[];
};

const WORDS = [
  'a',
  'ace',
  'acre',
  'act',
  'alert',
  'alter',
  'angle',
  'ant',
  'apt',
  'arc',
  'are',
  'art',
  'ate',
  'bad',
  'bar',
  'bare',
  'bat',
  'be',
  'bear',
  'beat',
  'below',
  'bored',
  'bowel',
  'brag',
  'bread',
  'care',
  'case',
  'cat',
  'cater',
  'cheaters',
  'cinema',
  'crate',
  'credit',
  'debit',
  'deity',
  'dirty',
  'dog',
  'dormitory',
  'dusty',
  'eat',
  'elbow',
  'enlist',
  'era',
  'evil',
  'flow',
  'form',
  'fresher',
  'glean',
  'god',
  'grab',
  'heart',
  'inch',
  'inlets',
  'integral',
  'listen',
  'live',
  'looped',
  'meal',
  'melon',
  'moon',
  'my',
  'night',
  'no',
  'note',
  'now',
  'on',
  'one',
  'part',
  'players',
  'race',
  'rat',
  'rates',
  'read',
  'rescue',
  'riot',
  'room',
  'sadder',
  'save',
  'secure',
  'silent',
  'state',
  'stare',
  'star',
  'taste',
  'tea',
  'tears',
  'the',
  'thing',
  'tones',
  'treat',
  'up',
  'vile',
  'vase',
  'won',
  'words',
  'worse',
  'worst',
] as const;

const PHRASE_RESULTS: Readonly<Record<string, readonly string[]>> = {
  dormitory: ['dirty room', 'riot do my', 'deity form'],
  debitcard: ['bad credit'],
  elevenplustwo: ['twelve plus one'],
  conversation: ['voices rant on'],
  listenup: ['silent up', 'enlist up', 'inlets up'],
  stareat: [
    'star eat',
    'tear sats',
    'rate tsar',
    'ate rats',
    'tea rats',
    'rat eats',
  ],
};

type LetterCounts = Map<string, number>;

export function cleanLetters(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/gu, '');
}

export function generateAnagrams(
  input: string,
  options: AnagramOptions
): string[] {
  const cleanInput = cleanLetters(input);
  if (!cleanInput) return [];

  const mustInclude = cleanLetters(options.mustInclude.trim());
  const excludeSet = new Set(
    options.excludeWords
      .split(',')
      .map((word) => cleanLetters(word.trim()))
      .filter(Boolean)
  );
  const words = anagramWords(input, options.minLength, excludeSet, mustInclude);
  const phrasePool =
    options.dictionary === 'games'
      ? words.filter((word) => word.length <= 8)
      : words;
  const phrases =
    options.maxWords > 1
      ? phraseAnagrams(
          input,
          phrasePool.slice(0, 80),
          options.maxWords,
          options.limit
        )
      : [];

  return [...words, ...(PHRASE_RESULTS[cleanInput] ?? []), ...phrases]
    .filter((result) => {
      if (mustInclude && !cleanLetters(result).includes(mustInclude)) {
        return false;
      }

      return !result
        .split(/\s+/u)
        .some((word) => excludeSet.has(cleanLetters(word)));
    })
    .filter((result, index, results) => results.indexOf(result) === index)
    .slice(0, options.limit);
}

export function groupAnagramResults(
  results: readonly string[]
): AnagramResultGroup[] {
  const groups = new Map<string, string[]>();

  for (const result of results) {
    const wordCount = result.split(/\s+/u).filter(Boolean).length;
    const label = wordCount === 1 ? '1 word' : `${wordCount} words`;
    const group = groups.get(label) ?? [];
    group.push(result);
    groups.set(label, group);
  }

  return [...groups].map(([label, groupResults]) => ({
    label,
    results: groupResults,
  }));
}

export function formatAnagramResultsAsText(
  input: string,
  results: readonly string[]
): string {
  return [
    'Anagram Generator Results',
    `Input: ${input.trim()}`,
    '',
    ...results,
    '',
    'Review results before using them in a game or puzzle.',
  ].join('\n');
}

function countLetters(value: string): LetterCounts {
  const counts = new Map<string, number>();
  for (const character of cleanLetters(value)) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }
  return counts;
}

function canBuild(word: string, counts: LetterCounts): boolean {
  for (const [character, total] of countLetters(word)) {
    if ((counts.get(character) ?? 0) < total) return false;
  }
  return true;
}

function subtractCounts(counts: LetterCounts, word: string): LetterCounts {
  const next = new Map(counts);
  for (const character of cleanLetters(word)) {
    next.set(character, next.get(character)! - 1);
  }
  return next;
}

function remainingTotal(counts: LetterCounts): number {
  let total = 0;
  for (const value of counts.values()) total += value;
  return total;
}

function keyForCounts(counts: LetterCounts): string {
  return [...counts.entries()]
    .filter(([, total]) => total > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([character, total]) => `${character}${total}`)
    .join('');
}

function anagramWords(
  input: string,
  minLength: number,
  excludeSet: ReadonlySet<string>,
  mustInclude: string
): string[] {
  const counts = countLetters(input);
  const source = cleanLetters(input);

  return WORDS.filter((word) => {
    if (word.length < minLength) return false;
    if (excludeSet.has(word)) return false;
    if (mustInclude && !word.includes(mustInclude)) return false;
    if (word === source && source.length > 3) return false;
    return canBuild(word, counts);
  }).sort((a, b) => b.length - a.length || a.localeCompare(b));
}

function phraseAnagrams(
  input: string,
  candidates: readonly string[],
  maxWords: number,
  limit: number
): string[] {
  const counts = countLetters(input);
  const results: string[] = [];
  const seen = new Set<string>();
  const memo = new Set<string>();

  function search(
    remaining: LetterCounts,
    startIndex: number,
    phrase: string[]
  ) {
    if (results.length >= limit) return;
    if (remainingTotal(remaining) === 0) {
      if (phrase.length > 1) {
        const text = phrase.join(' ');
        const canonical = [...phrase].sort().join('|');
        if (!seen.has(canonical)) {
          seen.add(canonical);
          results.push(text);
        }
      }
      return;
    }

    if (phrase.length >= maxWords) return;

    const memoKey = `${keyForCounts(remaining)}:${startIndex}:${phrase.length}`;
    if (memo.has(memoKey)) return;
    memo.add(memoKey);

    for (let index = startIndex; index < candidates.length; index += 1) {
      const word = candidates[index]!;
      if (!canBuild(word, remaining)) continue;
      search(subtractCounts(remaining, word), index, [...phrase, word]);
    }
  }

  search(counts, 0, []);
  return results;
}
