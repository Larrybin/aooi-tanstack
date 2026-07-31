import { useMemo, useState, type ReactNode } from 'react';

import {
  clampCount,
  formatGroupsAsCsv,
  formatGroupsAsText,
  parseNames,
  splitNames,
  type SplitMode,
} from '../domain/groups';
import type { RandomGroupGeneratorHomeCopy } from './random-group-generator-home-copy';
import {
  buildNamesReadyText,
  buildResultStatus,
  buildSplitSummary,
} from './random-group-generator-workbench-copy';

type WorkbenchCopy = RandomGroupGeneratorHomeCopy['workbench'];

export function RandomGroupGeneratorWorkbench({
  copy,
}: {
  copy: WorkbenchCopy;
}) {
  const [namesText, setNamesText] = useState('');
  const [mode, setMode] = useState<SplitMode>('groups');
  const [count, setCount] = useState(4);
  const [prefix, setPrefix] = useState(copy.defaultGroupLabel);
  const [groups, setGroups] = useState<string[][]>([]);
  const [status, setStatus] = useState(copy.initialStatus);
  const names = useMemo(() => parseNames(namesText), [namesText]);
  const summary = buildSplitSummary(names.length, mode, count, copy);

  function generate(nextNames = names) {
    if (nextNames.length < 2) {
      setGroups([]);
      setStatus(copy.emptyError);
      return;
    }

    const nextGroups = splitNames({
      names: nextNames,
      mode,
      count,
    });
    const sizes = nextGroups.map((group) => group.length);
    const smallest = Math.min(...sizes);
    const largest = Math.max(...sizes);
    const balance =
      smallest === largest
        ? copy.equalBalanceStatus
            .replace('{count}', String(largest))
            .replace('{people}', largest === 1 ? 'person' : 'people')
        : copy.unevenBalanceStatus
            .replace('{smallest}', String(smallest))
            .replace('{largest}', String(largest));

    setGroups(nextGroups);
    setStatus(
      `${buildResultStatus(nextNames.length, nextGroups.length, copy)} ${balance}`
    );
  }

  function loadSample() {
    const sampleNames = [...copy.sampleNames];
    setNamesText(sampleNames.join('\n'));
    generate(sampleNames);
  }

  function reset() {
    setNamesText('');
    setMode('groups');
    setCount(4);
    setPrefix(copy.defaultGroupLabel);
    setGroups([]);
    setStatus(copy.initialStatus);
  }

  async function copyResults() {
    if (groups.length === 0) {
      setStatus(copy.emptyError);
      return;
    }

    try {
      await navigator.clipboard.writeText(formatGroupsAsText(groups, prefix));
      setStatus(copy.copiedStatus);
    } catch {
      setStatus(copy.copyError);
    }
  }

  function downloadCsv() {
    if (groups.length === 0) {
      setStatus(copy.emptyError);
      return;
    }

    const url = URL.createObjectURL(
      new Blob([formatGroupsAsCsv(groups, prefix)], {
        type: 'text/csv;charset=utf-8',
      })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'random-groups.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(copy.csvStatus);
  }

  function printResults() {
    if (groups.length === 0) {
      setStatus(copy.emptyError);
      return;
    }

    setStatus(copy.printStatus);
    window.print();
  }

  return (
    <section
      id="generator"
      aria-label={copy.resultsTitle}
      className="overflow-hidden rounded-xl border border-[#AAB7C3] bg-white shadow-[0_18px_50px_rgba(31,50,63,0.08)]"
    >
      <div className="grid xl:grid-cols-[0.95fr_0.8fr_1.25fr]">
        <section className="border-b border-[#AAB7C3] p-5 sm:p-6 xl:border-r xl:border-b-0">
          <PanelHeading index="1" title={copy.rosterTitle}>
            {copy.rosterDescription}
          </PanelHeading>
          <label
            htmlFor="random-group-names"
            className="mt-5 block text-sm font-black text-[#1F323F]"
          >
            {copy.namesLabel}
          </label>
          <textarea
            id="random-group-names"
            value={namesText}
            onChange={(event) => setNamesText(event.target.value)}
            placeholder={copy.namesPlaceholder}
            spellCheck={false}
            className="mt-2 min-h-72 w-full resize-y rounded-md border border-[#AAB7C3] bg-[linear-gradient(to_bottom,transparent_31px,rgba(170,183,195,0.28)_32px)] bg-[length:100%_32px] px-3 py-1.5 leading-8 text-[#1F323F] outline-none focus:border-[#2859A8] focus:ring-2 focus:ring-[#2859A8]/15 xl:min-h-96"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-[#5B6A74]" aria-live="polite">
              {buildNamesReadyText(names.length, copy)}
            </span>
            <button
              type="button"
              onClick={loadSample}
              className="font-bold text-[#2859A8] underline underline-offset-4"
            >
              {copy.sampleAction}
            </button>
          </div>
        </section>

        <section className="border-b border-[#AAB7C3] bg-[#EAF5F0] p-5 sm:p-6 xl:border-r xl:border-b-0">
          <PanelHeading index="2" title={copy.splitTitle}>
            {copy.splitDescription}
          </PanelHeading>
          <fieldset className="mt-5">
            <legend className="text-sm font-black text-[#1F323F]">
              {copy.splitMethod}
            </legend>
            <div className="mt-2 grid gap-2">
              <ModeButton
                checked={mode === 'groups'}
                label={copy.groupCountMode}
                onChange={() => setMode('groups')}
              />
              <ModeButton
                checked={mode === 'size'}
                label={copy.groupSizeMode}
                onChange={() => setMode('size')}
              />
            </div>
          </fieldset>

          <label
            htmlFor="random-group-count"
            className="mt-5 block text-sm font-black text-[#1F323F]"
          >
            {mode === 'groups' ? copy.groupCountLabel : copy.groupSizeLabel}
          </label>
          <div className="mt-2 grid grid-cols-[44px_1fr_44px] overflow-hidden rounded-md border border-[#AAB7C3] bg-white">
            <CountButton
              label={copy.decreaseCountLabel}
              onClick={() => setCount((value) => clampCount(value - 1))}
            >
              −
            </CountButton>
            <input
              id="random-group-count"
              type="number"
              min="1"
              max="99"
              value={count}
              onChange={(event) =>
                setCount(clampCount(Number(event.target.value)))
              }
              className="min-h-11 w-full border-x border-[#D1D9DF] bg-white text-center font-black text-[#1F323F] outline-none"
            />
            <CountButton
              label={copy.increaseCountLabel}
              onClick={() => setCount((value) => clampCount(value + 1))}
            >
              +
            </CountButton>
          </div>

          <label
            htmlFor="random-group-prefix"
            className="mt-5 block text-sm font-black text-[#1F323F]"
          >
            {copy.groupLabel}
          </label>
          <input
            id="random-group-prefix"
            value={prefix}
            maxLength={24}
            onChange={(event) => setPrefix(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-md border border-[#AAB7C3] bg-white px-3 text-[#1F323F] outline-none focus:border-[#2859A8]"
          />

          <p className="mt-5 min-h-20 border-y border-[#AAB7C3] py-3 text-sm leading-6 text-[#5B6A74]">
            {summary}
          </p>

          <div className="mt-5 grid gap-2">
            <button
              type="button"
              onClick={() => generate()}
              className="min-h-12 rounded-md border border-[#B84433] bg-[#D95A46] px-4 font-black text-white hover:bg-[#C94B39]"
            >
              {copy.generateAction}
            </button>
            <button
              type="button"
              onClick={() => generate()}
              className="min-h-11 rounded-md border border-[#AAB7C3] bg-white px-4 font-black text-[#1F323F]"
            >
              {copy.reshuffleAction}
            </button>
            <button
              type="button"
              onClick={reset}
              className="min-h-10 font-bold text-[#2859A8] underline underline-offset-4"
            >
              {copy.resetAction}
            </button>
          </div>
        </section>

        <section className="p-5 sm:p-6">
          <PanelHeading index="3" title={copy.resultsTitle}>
            <span aria-live="polite">{status}</span>
          </PanelHeading>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3 print:hidden">
            <ResultButton onClick={copyResults}>{copy.copyAction}</ResultButton>
            <ResultButton onClick={downloadCsv}>{copy.csvAction}</ResultButton>
            <ResultButton onClick={printResults}>
              {copy.printAction}
            </ResultButton>
          </div>

          <div
            className="mt-4 grid min-h-72 content-start gap-3 rounded-md border border-dashed border-[#AAB7C3] bg-[#F7F4ED] p-4 sm:grid-cols-2 xl:min-h-96"
            aria-live="polite"
          >
            {groups.length === 0 ? (
              <p className="self-center text-center text-sm leading-6 text-[#68757E] sm:col-span-2">
                {copy.emptyResult}
              </p>
            ) : (
              groups.map((group, groupIndex) => (
                <article
                  key={`${groupIndex}:${group.join('\u0000')}`}
                  className="break-inside-avoid rounded-md border border-[#AAB7C3] bg-white p-4"
                >
                  <h3 className="font-black text-[#1F323F]">
                    {prefix.trim() || copy.defaultGroupLabel} {groupIndex + 1} (
                    {group.length})
                  </h3>
                  <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[#4E606C]">
                    {group.map((name, nameIndex) => (
                      <li key={`${nameIndex}:${name}`}>{name}</li>
                    ))}
                  </ol>
                </article>
              ))
            )}
          </div>
          <p className="mt-4 text-sm leading-6 text-[#5B6A74]">
            {copy.reviewNote}
          </p>
        </section>
      </div>
    </section>
  );
}

function PanelHeading({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[32px_1fr] gap-3">
      <span className="grid size-8 place-items-center rounded-full bg-[#1F323F] text-sm font-black text-white">
        {index}
      </span>
      <div>
        <h2 className="text-lg font-black tracking-tight text-[#1F323F]">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#5B6A74]">{children}</p>
      </div>
    </div>
  );
}

function ModeButton({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label
      className={[
        'cursor-pointer rounded-md border px-3 py-3 text-sm font-bold',
        checked
          ? 'border-[#1F323F] bg-[#1F323F] text-white'
          : 'border-[#AAB7C3] bg-white text-[#1F323F]',
      ].join(' ')}
    >
      <input
        type="radio"
        name="random-group-mode"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );
}

function CountButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="text-lg font-black text-[#B84433]"
    >
      {children}
    </button>
  );
}

function ResultButton({
  onClick,
  children,
}: {
  onClick: () => void | Promise<void>;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-md border border-[#AAB7C3] bg-white px-3 text-sm font-black text-[#1F323F] hover:border-[#2859A8]"
    >
      {children}
    </button>
  );
}
