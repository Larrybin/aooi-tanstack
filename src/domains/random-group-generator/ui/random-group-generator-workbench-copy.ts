import type { SplitMode } from '../domain/groups';
import type { RandomGroupGeneratorHomeCopy } from './random-group-generator-home-copy';

type WorkbenchCopy = RandomGroupGeneratorHomeCopy['workbench'];

export function buildNamesReadyText(
  nameCount: number,
  copy: WorkbenchCopy
): string {
  return copy.namesReady
    .replace('{count}', String(nameCount))
    .replace(
      '{nameLabel}',
      countLabel(nameCount, copy.nameSingular, copy.namePlural)
    );
}

export function buildSplitSummary(
  nameCount: number,
  mode: SplitMode,
  count: number,
  copy: WorkbenchCopy
): string {
  if (nameCount === 0) return copy.emptySummary;

  const groupCount =
    mode === 'groups'
      ? Math.min(count, nameCount)
      : Math.ceil(nameCount / count);
  const template =
    mode === 'groups' ? copy.groupCountSummary : copy.groupSizeSummary;
  const summary = replaceCountLabels(
    template
      .replace('{names}', String(nameCount))
      .replace('{groups}', String(groupCount)),
    nameCount,
    groupCount,
    copy
  );

  return mode === 'groups'
    ? summary.replace('{extra}', String(nameCount % groupCount))
    : summary.replace('{size}', String(count));
}

export function buildResultStatus(
  nameCount: number,
  groupCount: number,
  copy: WorkbenchCopy
): string {
  return replaceCountLabels(
    copy.resultStatus
      .replace('{names}', String(nameCount))
      .replace('{groups}', String(groupCount)),
    nameCount,
    groupCount,
    copy
  );
}

function replaceCountLabels(
  value: string,
  nameCount: number,
  groupCount: number,
  copy: WorkbenchCopy
): string {
  return value
    .replace(
      '{nameLabel}',
      countLabel(nameCount, copy.nameSingular, copy.namePlural)
    )
    .replace(
      '{groupLabel}',
      countLabel(groupCount, copy.groupSingular, copy.groupPlural)
    );
}

function countLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
