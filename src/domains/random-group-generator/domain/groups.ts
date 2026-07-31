export type SplitMode = 'groups' | 'size';

type SplitNamesInput = {
  names: readonly string[];
  mode: SplitMode;
  count: number;
  random?: () => number;
};

export function parseNames(value: string): string[] {
  return value
    .split(/\n|,/u)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function splitNames({
  names,
  mode,
  count,
  random = Math.random,
}: SplitNamesInput): string[][] {
  if (names.length < 2) {
    throw new Error('Add at least two names before generating random groups.');
  }

  const normalizedCount = clampCount(count);
  const shuffled = shuffle(names, random);

  if (mode === 'size') {
    const groups: string[][] = [];
    for (let index = 0; index < shuffled.length; index += normalizedCount) {
      groups.push(shuffled.slice(index, index + normalizedCount));
    }
    return groups;
  }

  const groupTotal = Math.min(normalizedCount, shuffled.length);
  const groups = Array.from({ length: groupTotal }, (): string[] => []);

  shuffled.forEach((name, index) => {
    groups[index % groupTotal]!.push(name);
  });
  return groups;
}

export function formatGroupsAsText(
  groups: readonly (readonly string[])[],
  prefix: string
): string {
  const label = normalizePrefix(prefix);

  return groups
    .map((group, index) => {
      const names = group.map((name) => `- ${name}`).join('\n');
      return `${label} ${index + 1} (${group.length})\n${names}`;
    })
    .join('\n\n');
}

export function formatGroupsAsCsv(
  groups: readonly (readonly string[])[],
  prefix: string
): string {
  const label = normalizePrefix(prefix);
  const rows = [['Group', 'Position', 'Name']];

  groups.forEach((group, groupIndex) => {
    group.forEach((name, nameIndex) => {
      rows.push([`${label} ${groupIndex + 1}`, String(nameIndex + 1), name]);
    });
  });

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(99, Math.trunc(value)));
}

function normalizePrefix(prefix: string): string {
  return prefix.trim() || 'Group';
}

function escapeCsvCell(value: string): string {
  const safeValue = /^[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function shuffle(names: readonly string[], random: () => number): string[] {
  const shuffled = [...names];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex]!,
      shuffled[index]!,
    ];
  }

  return shuffled;
}
