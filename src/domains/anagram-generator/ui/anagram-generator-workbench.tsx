import { useMemo, useState } from 'react';

import {
  formatAnagramResultsAsText,
  generateAnagrams,
  groupAnagramResults,
  type AnagramDictionary,
  type AnagramOptions,
} from '../domain/anagrams';
import type { AnagramGeneratorHomeCopy } from './anagram-generator-home-copy';

type WorkbenchCopy = AnagramGeneratorHomeCopy['workbench'];

const maxWordValues = [1, 2, 3, 4, 5] as const;
const minimumLengthValues = [2, 3, 4, 5] as const;
const resultLimitValues = [50, 100, 200, 400] as const;

export function AnagramGeneratorWorkbench({ copy }: { copy: WorkbenchCopy }) {
  const [input, setInput] = useState('');
  const [dictionary, setDictionary] = useState<AnagramDictionary>('common');
  const [maxWords, setMaxWords] = useState(5);
  const [minLength, setMinLength] = useState(2);
  const [mustInclude, setMustInclude] = useState('');
  const [excludeWords, setExcludeWords] = useState('');
  const [limit, setLimit] = useState(200);
  const [results, setResults] = useState<string[] | null>(null);
  const [status, setStatus] = useState('');
  const groups = useMemo(
    () => (results ? groupAnagramResults(results) : []),
    [results]
  );

  function runGenerator(
    nextInput = input,
    overrides: Partial<AnagramOptions> = {}
  ) {
    if (!nextInput.trim()) {
      setResults(null);
      return;
    }

    setResults(
      generateAnagrams(nextInput, {
        dictionary,
        maxWords,
        minLength,
        mustInclude,
        excludeWords,
        limit,
        ...overrides,
      })
    );
  }

  function loadSample() {
    const sample = 'stare at';
    setInput(sample);
    setMaxWords(4);
    setMinLength(2);
    setMustInclude('');
    setExcludeWords('');
    setStatus('');
    runGenerator(sample, {
      maxWords: 4,
      minLength: 2,
      mustInclude: '',
      excludeWords: '',
    });
  }

  function clear() {
    setInput('');
    setMustInclude('');
    setExcludeWords('');
    setResults(null);
    setStatus('');
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLTextAreaElement>('#anagram-input')?.focus()
    );
  }

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(successMessage);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.readOnly = true;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      setStatus(copied ? successMessage : copy.copyErrorStatus);
    }
  }

  function downloadResults() {
    if (!results?.length) return;
    const url = URL.createObjectURL(
      new Blob([formatAnagramResultsAsText(input, results)], {
        type: 'text/plain',
      })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'anagram-results.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 250);
    setStatus(copy.downloadStatus);
  }

  return (
    <section
      id="generator"
      aria-label={copy.workspaceLabel}
      className="grid overflow-hidden rounded-xl border border-[#D7DEE8] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:grid-cols-2"
    >
      <section className="border-b border-[#CBD5E1] p-5 sm:p-7 lg:border-r lg:border-b-0">
        <h2 className="text-xl font-extrabold text-[#0F172A]">
          {copy.inputTitle}
        </h2>
        <label htmlFor="anagram-input" className="mt-5 block">
          <span className="flex items-center justify-between gap-4 text-sm font-bold text-[#1E293B]">
            <span>{copy.inputLabel}</span>
            <span className="font-medium text-[#64748B]">
              {copy.characterCount
                .replace('{count}', String(input.length))
                .replace('{limit}', '500')}
            </span>
          </span>
          <span className="mt-1 block text-sm leading-6 text-[#64748B]">
            {copy.inputHelp}
          </span>
          <textarea
            id="anagram-input"
            value={input}
            maxLength={500}
            rows={6}
            spellCheck={false}
            placeholder={copy.inputPlaceholder}
            onChange={(event) => setInput(event.target.value)}
            className="mt-2 min-h-40 w-full resize-y rounded-lg border border-[#CBD5E1] bg-[#F4F7FB] px-4 py-3 text-[#0F172A] outline-none focus:border-[#4F6EF7] focus:ring-2 focus:ring-[#4F6EF7]/15"
          />
        </label>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <SelectField
            id="anagram-dictionary"
            label={copy.dictionaryLabel}
            value={dictionary}
            onChange={(value) => setDictionary(value as AnagramDictionary)}
            options={[
              ['common', copy.dictionaries.common],
              ['games', copy.dictionaries.games],
              ['phrases', copy.dictionaries.phrases],
            ]}
          />
          <SelectField
            id="anagram-max-words"
            label={copy.maxWordsLabel}
            value={String(maxWords)}
            onChange={(value) => setMaxWords(Number(value))}
            options={maxWordValues.map((value, index) => [
              String(value),
              copy.maxWordsOptions[index]!,
            ])}
          />
          <SelectField
            id="anagram-minimum-length"
            label={copy.minimumLengthLabel}
            value={String(minLength)}
            onChange={(value) => setMinLength(Number(value))}
            options={minimumLengthValues.map((value) => [
              String(value),
              String(value),
            ])}
          />
          <TextField
            id="anagram-must-include"
            label={`${copy.mustIncludeLabel} ${copy.optionalLabel}`}
            value={mustInclude}
            placeholder={copy.mustIncludePlaceholder}
            help={copy.mustIncludeHelp}
            onChange={setMustInclude}
          />
          <TextField
            id="anagram-exclude-words"
            label={`${copy.excludeWordsLabel} ${copy.optionalLabel}`}
            value={excludeWords}
            placeholder={copy.excludeWordsPlaceholder}
            help={copy.excludeWordsHelp}
            onChange={setExcludeWords}
          />
          <SelectField
            id="anagram-result-limit"
            label={copy.resultLimitLabel}
            value={String(limit)}
            onChange={(value) => setLimit(Number(value))}
            options={resultLimitValues.map((value) => [
              String(value),
              String(value),
            ])}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => runGenerator()}
            className="min-h-11 rounded-lg bg-[#4F6EF7] px-5 font-bold text-white hover:bg-[#3F5DDD]"
          >
            {copy.generateAction}
          </button>
          <button
            type="button"
            onClick={loadSample}
            className="min-h-11 rounded-lg border border-[#B9C8FF] bg-[#E6EEFF] px-5 font-bold text-[#2742A3] hover:bg-[#D8E3FF]"
          >
            {copy.sampleAction}
          </button>
          <button
            type="button"
            onClick={clear}
            className="min-h-11 rounded-lg border border-[#CBD5E1] bg-white px-5 font-bold text-[#334155] hover:bg-[#F4F7FB]"
          >
            {copy.clearAction}
          </button>
        </div>
      </section>

      <section className="min-w-0 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-[#0F172A]">
            {copy.resultsTitle}
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!results?.length}
              onClick={() =>
                results && copyText(results.join('\n'), copy.copyAllStatus)
              }
              className="min-h-9 rounded-md border border-[#CBD5E1] px-3 text-sm font-bold text-[#334155] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copy.copyAllAction}
            </button>
            <button
              type="button"
              disabled={!results?.length}
              onClick={downloadResults}
              className="min-h-9 rounded-md border border-[#CBD5E1] px-3 text-sm font-bold text-[#334155] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copy.downloadAction}
            </button>
          </div>
        </div>

        <div aria-live="polite" className="mt-5 min-h-96">
          {results === null ? (
            <ResultState
              title={copy.emptyTitle}
              description={copy.emptyDescription}
            />
          ) : results.length === 0 ? (
            <ResultState
              title={copy.noResultsTitle}
              description={copy.noResultsDescription}
            />
          ) : (
            <div>
              <div className="flex flex-wrap justify-between gap-2 border-b border-[#E6EBF2] pb-3">
                <h3 className="font-bold text-[#0F172A]">
                  {copy.populatedTitle}
                </h3>
                <p className="text-sm text-[#64748B]">
                  {copy.resultSummary
                    .replace('{groups}', String(groups.length))
                    .replace('{results}', String(results.length))}
                </p>
              </div>
              <div className="divide-y divide-slate-200">
                {groups.map((group) => (
                  <article
                    key={group.label}
                    className="grid min-w-0 gap-3 py-4 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-start"
                  >
                    <h4 className="font-bold text-[#1E293B]">
                      {copy.groupSummary
                        .replace('{label}', group.label)
                        .replace('{count}', String(group.results.length))}
                    </h4>
                    <p className="min-w-0 text-sm leading-6 break-words text-[#475569]">
                      {group.results.slice(0, 8).join(', ')}
                      {group.results.length > 8 ? ', ...' : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          group.results.join('\n'),
                          copy.copyGroupStatus.replace('{label}', group.label)
                        )
                      }
                      className="justify-self-start rounded-md border border-[#CBD5E1] px-3 py-1.5 text-sm font-bold text-[#3452C7]"
                    >
                      {copy.copyGroupAction}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
        {status ? (
          <p role="status" className="mt-4 text-sm font-medium text-[#3452C7]">
            {status}
          </p>
        ) : null}
      </section>
    </section>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-bold text-[#1E293B]">
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 font-medium text-[#1E293B]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  id,
  label,
  value,
  placeholder,
  help,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  help: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-bold text-[#1E293B]">
      {label}
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 font-medium text-[#1E293B]"
      />
      <span className="mt-1 block text-xs font-normal text-[#64748B]">
        {help}
      </span>
    </label>
  );
}

function ResultState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-80 place-content-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#F4F7FB] p-6 text-center">
      <h3 className="font-bold text-[#1E293B]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#64748B]">
        {description}
      </p>
    </div>
  );
}
