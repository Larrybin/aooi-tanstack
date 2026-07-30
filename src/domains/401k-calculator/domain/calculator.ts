export const DEFAULT_CALCULATOR_DRAFT = {
  currentAge: '35',
  retirementAge: '67',
  currentBalance: '50000',
  annualSalary: '75000',
  employeeContributionPercent: '10',
  employerMatchPercent: '50',
  matchLimitPercent: '6',
  annualReturnPercent: '6',
  salaryIncreasePercent: '3',
} as const satisfies CalculatorDraft;

export type CalculatorDraft = {
  currentAge: string;
  retirementAge: string;
  currentBalance: string;
  annualSalary: string;
  employeeContributionPercent: string;
  employerMatchPercent: string;
  matchLimitPercent: string;
  annualReturnPercent: string;
  salaryIncreasePercent: string;
};

export type CalculatorValues = {
  [Field in keyof CalculatorDraft]: number;
};

export type CalculatorField = keyof CalculatorDraft;

export type CalculatorValidation =
  | {
      ok: true;
      values: CalculatorValues;
    }
  | {
      ok: false;
      errors: Partial<Record<CalculatorField, string>>;
    };

export type ProjectionRow = {
  year: number;
  age: number;
  salary: number;
  employeeContribution: number;
  employerMatch: number;
  balance: number;
};

export type ProjectionResult = {
  projectedBalance: number;
  userContributions: number;
  employerMatchTotal: number;
  investmentGrowth: number;
  monthlyRetirementIncome: number;
  rows: ProjectionRow[];
};

const FIELD_LABELS: Record<CalculatorField, string> = {
  currentAge: 'Current age',
  retirementAge: 'Retirement age',
  currentBalance: 'Current 401(k) balance',
  annualSalary: 'Annual salary',
  employeeContributionPercent: 'Employee contribution',
  employerMatchPercent: 'Employer match',
  matchLimitPercent: 'Match limit',
  annualReturnPercent: 'Annual return assumption',
  salaryIncreasePercent: 'Annual salary increase',
};

const FIELDS = Object.keys(FIELD_LABELS) as CalculatorField[];
const AGE_FIELDS = new Set<CalculatorField>(['currentAge', 'retirementAge']);
const PERCENT_FIELDS = new Set<CalculatorField>([
  'employeeContributionPercent',
  'employerMatchPercent',
  'matchLimitPercent',
  'annualReturnPercent',
  'salaryIncreasePercent',
]);
const DOLLAR_FIELDS = new Set<CalculatorField>([
  'currentBalance',
  'annualSalary',
]);
const MAX_DOLLARS = 1_000_000_000_000;

export function validateCalculatorDraft(
  draft: CalculatorDraft
): CalculatorValidation {
  const values = {} as CalculatorValues;
  const errors: Partial<Record<CalculatorField, string>> = {};

  for (const field of FIELDS) {
    const rawValue = draft[field].trim();
    const label = FIELD_LABELS[field];

    if (!rawValue) {
      errors[field] = `${label} is required.`;
      continue;
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      errors[field] = `${label} must be a number.`;
    } else if (value < 0) {
      errors[field] = `${label} cannot be negative.`;
    } else if (AGE_FIELDS.has(field) && !Number.isInteger(value)) {
      errors[field] = `${label} must be a whole number.`;
    } else if (AGE_FIELDS.has(field) && value > 120) {
      errors[field] = `${label} must be 120 or less.`;
    } else if (PERCENT_FIELDS.has(field) && value > 100) {
      errors[field] = `${label} must be between 0 and 100.`;
    } else if (DOLLAR_FIELDS.has(field) && value > MAX_DOLLARS) {
      errors[field] = `${label} must be $1 trillion or less.`;
    } else {
      values[field] = value;
    }
  }

  if (
    Object.keys(errors).length === 0 &&
    values.retirementAge <= values.currentAge
  ) {
    errors.retirementAge = 'Retirement age must be greater than current age.';
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, values };
}

export function calculateProjection(
  values: CalculatorValues
): ProjectionResult {
  const startingBalance = values.currentBalance;
  let balance = startingBalance;
  let salary = values.annualSalary;
  const years = values.retirementAge - values.currentAge;
  const employeeContributionPercent = values.employeeContributionPercent / 100;
  const employerMatchPercent = values.employerMatchPercent / 100;
  const matchLimitPercent = values.matchLimitPercent / 100;
  const annualReturn = values.annualReturnPercent / 100;
  const salaryIncrease = values.salaryIncreasePercent / 100;
  let userContributions = 0;
  let employerMatchTotal = 0;
  const rows: ProjectionRow[] = [];

  for (let year = 1; year <= years; year += 1) {
    salary *= 1 + salaryIncrease;
    const employeeContribution = salary * employeeContributionPercent;
    const eligibleMatchPercent = Math.min(
      employeeContributionPercent,
      matchLimitPercent
    );
    const employerMatch = salary * eligibleMatchPercent * employerMatchPercent;
    balance =
      balance * (1 + annualReturn) + employeeContribution + employerMatch;
    userContributions += employeeContribution;
    employerMatchTotal += employerMatch;
    rows.push({
      year,
      age: values.currentAge + year,
      salary,
      employeeContribution,
      employerMatch,
      balance,
    });
  }

  const investmentGrowth = Math.max(
    0,
    balance - startingBalance - userContributions - employerMatchTotal
  );

  return {
    projectedBalance: balance,
    userContributions,
    employerMatchTotal,
    investmentGrowth,
    monthlyRetirementIncome: (balance * 0.04) / 12,
    rows,
  };
}
