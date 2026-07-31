import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';

import {
  calculateProjection,
  DEFAULT_CALCULATOR_DRAFT,
  validateCalculatorDraft,
  type CalculatorDraft,
  type CalculatorField,
  type ProjectionResult,
} from '../domain/calculator';
import type { CalculatorHomeCopy } from './401k-calculator-home-copy';

const INPUT_GROUPS: readonly (readonly CalculatorField[])[] = [
  ['currentAge', 'retirementAge'],
  ['currentBalance', 'annualSalary'],
  ['employeeContributionPercent', 'employerMatchPercent'],
  ['matchLimitPercent', 'annualReturnPercent'],
  ['salaryIncreasePercent'],
];

const DOLLAR_FIELDS = new Set<CalculatorField>([
  'currentBalance',
  'annualSalary',
]);
const PERCENT_FIELDS = new Set<CalculatorField>([
  'employeeContributionPercent',
  'employerMatchPercent',
  'matchLimitPercent',
  'annualReturnPercent',
  'salaryIncreasePercent',
]);
const AGE_FIELDS = new Set<CalculatorField>(['currentAge', 'retirementAge']);

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function CalculatorWorkbench({ copy }: { copy: CalculatorHomeCopy }) {
  const [draft, setDraft] = useState<CalculatorDraft>({
    ...DEFAULT_CALCULATOR_DRAFT,
  });
  const validation = useMemo(() => validateCalculatorDraft(draft), [draft]);
  const result = useMemo(
    () => (validation.ok ? calculateProjection(validation.values) : null),
    [validation]
  );

  function updateField(field: CalculatorField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function reset() {
    setDraft({ ...DEFAULT_CALCULATOR_DRAFT });
  }

  return (
    <>
      <div
        id="calculator"
        className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]"
      >
        <section
          className="rounded-2xl border border-[#D6E0DA] bg-white p-5 shadow-[0_16px_50px_rgba(17,49,34,0.07)] md:p-7"
          aria-labelledby="calculator-input-heading"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <SectionLabel index="01">
                {copy.calculator.sectionLabel}
              </SectionLabel>
              <h2
                id="calculator-input-heading"
                className="mt-3 text-2xl font-semibold tracking-tight text-[#163525]"
              >
                {copy.calculator.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#C9D7CF] px-3 text-sm font-medium text-[#315D45] transition hover:border-[#789A87] hover:bg-[#F2F7F4]"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {copy.calculator.reset}
            </button>
          </div>

          {!validation.ok ? (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-[#E7B5B5] bg-[#FFF4F4] px-4 py-3 text-sm text-[#8B2929]"
            >
              Correct the highlighted fields to update the projection.
            </div>
          ) : null}

          <form className="mt-6 space-y-5" noValidate>
            {INPUT_GROUPS.map((group) => (
              <div
                key={group.join('-')}
                className={[
                  'grid gap-4',
                  group.length > 1 ? 'sm:grid-cols-2' : '',
                ].join(' ')}
              >
                {group.map((field) => {
                  const fieldCopy = copy.calculator.fields[field];
                  const error = validation.ok
                    ? undefined
                    : validation.errors[field];
                  const helperId = `${field}-helper`;
                  const errorId = `${field}-error`;

                  return (
                    <label key={field} className="block">
                      <span className="text-sm font-semibold text-[#244A35]">
                        {fieldCopy.label}
                      </span>
                      <span
                        className={[
                          'mt-2 flex min-h-12 items-center overflow-hidden rounded-lg border bg-white focus-within:ring-2',
                          error
                            ? 'border-[#C95A5A] focus-within:ring-[#E8A2A2]'
                            : 'border-[#C9D7CF] focus-within:border-[#26724A] focus-within:ring-[#BDE0CB]',
                        ].join(' ')}
                      >
                        {DOLLAR_FIELDS.has(field) ? (
                          <span className="pl-3 text-[#587060]">$</span>
                        ) : null}
                        <input
                          name={field}
                          type="number"
                          inputMode={
                            AGE_FIELDS.has(field) ? 'numeric' : 'decimal'
                          }
                          min="0"
                          max={
                            AGE_FIELDS.has(field)
                              ? 120
                              : PERCENT_FIELDS.has(field)
                                ? 100
                                : 1_000_000_000_000
                          }
                          step={AGE_FIELDS.has(field) ? 1 : 0.1}
                          value={draft[field]}
                          onChange={(event) =>
                            updateField(field, event.currentTarget.value)
                          }
                          aria-invalid={Boolean(error)}
                          aria-describedby={
                            [
                              fieldCopy.helper ? helperId : '',
                              error ? errorId : '',
                            ]
                              .filter(Boolean)
                              .join(' ') || undefined
                          }
                          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base text-[#163525] outline-none"
                        />
                        {PERCENT_FIELDS.has(field) ? (
                          <span className="pr-3 text-[#587060]">%</span>
                        ) : null}
                      </span>
                      {fieldCopy.helper ? (
                        <span
                          id={helperId}
                          className="mt-1.5 block text-xs leading-5 text-[#64766B]"
                        >
                          {fieldCopy.helper}
                        </span>
                      ) : null}
                      {error ? (
                        <span
                          id={errorId}
                          className="mt-1.5 block text-xs font-medium text-[#A43838]"
                        >
                          {error}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            ))}
          </form>

          <div className="mt-6 rounded-xl border border-[#D7E4DC] bg-[#F5F9F6] p-4 text-xs leading-5 text-[#466151]">
            {copy.calculator.disclaimer.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </section>

        <ResultsCard copy={copy} result={result} />
      </div>

      <ProjectionTable copy={copy} result={result} />
    </>
  );
}

function ResultsCard({
  copy,
  result,
}: {
  copy: CalculatorHomeCopy;
  result: ProjectionResult | null;
}) {
  const metrics = [
    [copy.calculator.userContributions, result?.userContributions],
    [copy.calculator.employerMatch, result?.employerMatchTotal],
    [copy.calculator.investmentGrowth, result?.investmentGrowth],
    [copy.calculator.monthlyIncome, result?.monthlyRetirementIncome],
  ] as const;

  return (
    <aside
      className="rounded-2xl bg-[#173D29] p-5 text-white shadow-[0_20px_60px_rgba(15,55,34,0.2)] md:p-7"
      aria-labelledby="calculator-results-heading"
    >
      <SectionLabel dark>{copy.calculator.resultsLabel}</SectionLabel>
      <h2
        id="calculator-results-heading"
        className="mt-3 text-2xl font-semibold tracking-tight"
      >
        {copy.calculator.resultsTitle}
      </h2>

      <div className="mt-7 rounded-xl border border-white/15 bg-white/10 p-5">
        <span className="text-sm text-[#C9E2D2]">
          {copy.calculator.projectedBalance}
        </span>
        <strong className="mt-2 block text-4xl font-semibold tracking-tight break-words text-white">
          {formatCurrency(result?.projectedBalance)}
        </strong>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 p-4">
            <span className="text-xs leading-5 text-[#C9E2D2]">{label}</span>
            <strong className="mt-1 block text-lg font-semibold">
              {formatCurrency(value)}
            </strong>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-white/15 pt-5">
        <h3 className="text-sm font-semibold">
          {copy.calculator.assumptionsTitle}
        </h3>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-[#C9E2D2]">
          {copy.calculator.assumptions.map((assumption) => (
            <li key={assumption} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#7ED69F]" />
              <span>{assumption}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function ProjectionTable({
  copy,
  result,
}: {
  copy: CalculatorHomeCopy;
  result: ProjectionResult | null;
}) {
  return (
    <section className="mt-7 rounded-2xl border border-[#D6E0DA] bg-white p-5 shadow-[0_16px_50px_rgba(17,49,34,0.05)] md:p-7">
      <SectionLabel index="02">{copy.projection.label}</SectionLabel>
      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-[#163525]">
          {copy.projection.title}
        </h2>
        <p className="text-sm text-[#64766B]">{copy.projection.description}</p>
      </div>
      <ProjectionChart copy={copy} result={result} />
      <div className="mt-5 max-h-[28rem] overflow-auto rounded-xl border border-[#D6E0DA]">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <thead className="sticky top-0 bg-[#EDF4EF] text-left text-xs tracking-wider text-[#466151] uppercase">
            <tr>
              <th className="px-4 py-3">{copy.projection.age}</th>
              <th className="px-4 py-3">{copy.projection.salary}</th>
              <th className="px-4 py-3">
                {copy.projection.employeeContribution}
              </th>
              <th className="px-4 py-3">{copy.projection.employerMatch}</th>
              <th className="px-4 py-3">{copy.projection.balance}</th>
            </tr>
          </thead>
          <tbody>
            {(result?.rows ?? []).map((row) => (
              <tr
                key={row.year}
                className="border-t border-[#E3EAE5] text-[#294737]"
              >
                <td className="px-4 py-3 font-medium">{row.age}</td>
                <td className="px-4 py-3">{currency.format(row.salary)}</td>
                <td className="px-4 py-3">
                  {currency.format(row.employeeContribution)}
                </td>
                <td className="px-4 py-3">
                  {currency.format(row.employerMatch)}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {currency.format(row.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProjectionChart({
  copy,
  result,
}: {
  copy: CalculatorHomeCopy;
  result: ProjectionResult | null;
}) {
  const rows = selectProjectionMilestones(result?.rows ?? []);
  const maxBalance = Math.max(...rows.map((row) => row.balance), 1);

  return (
    <div
      role="img"
      aria-label={copy.projection.title}
      className="mt-6 space-y-3 rounded-xl border border-[#D6E0DA] bg-[#F7FAF8] p-4 md:p-5"
    >
      {rows.map((row) => (
        <div
          key={row.year}
          data-projection-milestone={row.age}
          className="grid grid-cols-[3.75rem_minmax(0,1fr)_5rem] items-center gap-2 text-xs sm:grid-cols-[4.25rem_minmax(0,1fr)_6rem]"
        >
          <span className="font-medium text-[#466151]">Age {row.age}</span>
          <span className="h-3 overflow-hidden rounded-full bg-[#DCE9E0]">
            <span
              className="block h-full rounded-full bg-[#2E8B57]"
              style={{
                width: `${Math.max((row.balance / maxBalance) * 100, 1)}%`,
              }}
            />
          </span>
          <strong className="text-right font-semibold text-[#173526]">
            {compactCurrency.format(row.balance)}
          </strong>
        </div>
      ))}
    </div>
  );
}

function selectProjectionMilestones(rows: ProjectionResult['rows']) {
  const milestoneCount = 9;
  if (rows.length <= milestoneCount) {
    return rows;
  }

  return Array.from({ length: milestoneCount }, (_, index) => {
    const rowIndex = Math.round(
      (index * (rows.length - 1)) / (milestoneCount - 1)
    );
    return rows[rowIndex]!;
  });
}

function SectionLabel({
  children,
  index,
  dark = false,
}: {
  children: string;
  index?: string;
  dark?: boolean;
}) {
  return (
    <p
      className={[
        'flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase',
        dark ? 'text-[#A9D8BB]' : 'text-[#367652]',
      ].join(' ')}
    >
      <span
        className={[
          'size-2 rounded-full',
          dark ? 'bg-[#7ED69F]' : 'bg-[#2E8B57]',
        ].join(' ')}
      />
      {index ? <span>{index}</span> : null}
      <span>{children}</span>
    </p>
  );
}

function formatCurrency(value: number | undefined) {
  return value === undefined ? '—' : currency.format(value);
}

const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
