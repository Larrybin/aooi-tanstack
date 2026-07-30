import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateProjection,
  DEFAULT_CALCULATOR_DRAFT,
  validateCalculatorDraft,
  type CalculatorDraft,
} from './calculator';

function withDraft(overrides: Partial<CalculatorDraft> = {}): CalculatorDraft {
  return { ...DEFAULT_CALCULATOR_DRAFT, ...overrides };
}

test('default inputs reproduce the recovered production projection', () => {
  const validation = validateCalculatorDraft(DEFAULT_CALCULATOR_DRAFT);
  assert.equal(validation.ok, true);
  if (!validation.ok) return;

  const result = calculateProjection(validation.values);

  assert.equal(result.rows.length, 32);
  assert.equal(result.rows[0]?.age, 36);
  assert.equal(result.rows[0]?.salary, 77_250);
  assert.equal(result.rows.at(-1)?.age, 67);
  assert.equal(Math.round(result.projectedBalance), 1_620_932);
  assert.equal(Math.round(result.userContributions), 405_584);
  assert.equal(Math.round(result.employerMatchTotal), 121_675);
  assert.equal(Math.round(result.investmentGrowth), 1_043_673);
  assert.equal(Math.round(result.monthlyRetirementIncome), 5_403);
});

test('salary grows before contributions and return applies to the prior balance', () => {
  const validation = validateCalculatorDraft(
    withDraft({
      currentAge: '64',
      retirementAge: '65',
      annualReturnPercent: '100',
    })
  );
  assert.equal(validation.ok, true);
  if (!validation.ok) return;

  const result = calculateProjection(validation.values);

  assert.equal(result.projectedBalance, 110_042.5);
});

test('zero balance, contribution, and employer match are valid inputs', () => {
  const validation = validateCalculatorDraft(
    withDraft({
      currentBalance: '0',
      employeeContributionPercent: '0',
      employerMatchPercent: '0',
    })
  );
  assert.equal(validation.ok, true);
  if (!validation.ok) return;

  const result = calculateProjection(validation.values);

  assert.equal(result.userContributions, 0);
  assert.equal(result.employerMatchTotal, 0);
});

test('one year before retirement produces one annual row', () => {
  const validation = validateCalculatorDraft(
    withDraft({ currentAge: '66', retirementAge: '67' })
  );
  assert.equal(validation.ok, true);
  if (!validation.ok) return;

  const result = calculateProjection(validation.values);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.age, 67);
});

const requiredCases: Array<[keyof CalculatorDraft, string]> = [
  ['currentAge', 'Current age is required.'],
  ['retirementAge', 'Retirement age is required.'],
  ['currentBalance', 'Current 401(k) balance is required.'],
  ['annualSalary', 'Annual salary is required.'],
  ['employeeContributionPercent', 'Employee contribution is required.'],
  ['employerMatchPercent', 'Employer match is required.'],
  ['matchLimitPercent', 'Match limit is required.'],
  ['annualReturnPercent', 'Annual return assumption is required.'],
  ['salaryIncreasePercent', 'Annual salary increase is required.'],
];

for (const [field, message] of requiredCases) {
  test(`${field} is required`, () => {
    const result = validateCalculatorDraft(withDraft({ [field]: ' ' }));

    assert.deepEqual(result, {
      ok: false,
      errors: { [field]: message },
    });
  });
}

test('non-numeric input is rejected', () => {
  const result = validateCalculatorDraft(withDraft({ annualSalary: 'salary' }));

  assert.deepEqual(result, {
    ok: false,
    errors: { annualSalary: 'Annual salary must be a number.' },
  });
});

test('negative input is rejected', () => {
  const result = validateCalculatorDraft(withDraft({ currentBalance: '-1' }));

  assert.deepEqual(result, {
    ok: false,
    errors: {
      currentBalance: 'Current 401(k) balance cannot be negative.',
    },
  });
});

test('percentage inputs are limited to 100', () => {
  const result = validateCalculatorDraft(
    withDraft({ annualReturnPercent: '100.1' })
  );

  assert.deepEqual(result, {
    ok: false,
    errors: {
      annualReturnPercent:
        'Annual return assumption must be between 0 and 100.',
    },
  });
});

test('ages must be whole numbers no greater than 120', () => {
  assert.deepEqual(validateCalculatorDraft(withDraft({ currentAge: '35.5' })), {
    ok: false,
    errors: { currentAge: 'Current age must be a whole number.' },
  });
  assert.deepEqual(
    validateCalculatorDraft(withDraft({ retirementAge: '121' })),
    {
      ok: false,
      errors: { retirementAge: 'Retirement age must be 120 or less.' },
    }
  );
});

test('retirement age must be greater than current age', () => {
  const result = validateCalculatorDraft(
    withDraft({ currentAge: '67', retirementAge: '66' })
  );

  assert.deepEqual(result, {
    ok: false,
    errors: {
      retirementAge: 'Retirement age must be greater than current age.',
    },
  });
});

test('balance and salary are capped at one trillion dollars', () => {
  assert.equal(
    validateCalculatorDraft(withDraft({ currentBalance: '1000000000000' })).ok,
    true
  );
  assert.deepEqual(
    validateCalculatorDraft(withDraft({ annualSalary: '1000000000000.01' })),
    {
      ok: false,
      errors: {
        annualSalary: 'Annual salary must be $1 trillion or less.',
      },
    }
  );
});
