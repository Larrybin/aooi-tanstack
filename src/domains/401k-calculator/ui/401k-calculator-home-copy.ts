import type { CalculatorField } from '../domain/calculator';

type CalculatorFieldCopy = {
  label: string;
  helper?: string;
};

export type CalculatorHomeCopy = {
  metadata: {
    title: string;
    description: string;
    keywords: readonly string[];
  };
  shell: {
    formula: string;
    howTo: string;
    faq: string;
    footerDescription: string;
    productGroup: string;
    tool: string;
    trustGroup: string;
    privacyPolicy: string;
    termsOfService: string;
    copyrightSuffix: string;
  };
  hero: {
    title: string;
    description: string;
    privacyNote: string;
    includesTitle: string;
    includes: readonly string[];
  };
  calculator: {
    sectionLabel: string;
    title: string;
    reset: string;
    fields: Record<CalculatorField, CalculatorFieldCopy>;
    resultsLabel: string;
    resultsTitle: string;
    projectedBalance: string;
    userContributions: string;
    employerMatch: string;
    investmentGrowth: string;
    monthlyIncome: string;
    assumptionsTitle: string;
    assumptions: readonly string[];
    disclaimer: readonly string[];
  };
  projection: {
    label: string;
    title: string;
    description: string;
    age: string;
    salary: string;
    employeeContribution: string;
    employerMatch: string;
    balance: string;
  };
  formula: {
    label: string;
    title: string;
    description: string;
    lines: readonly string[];
    estimateTitle: string;
    estimateDescription: string;
  };
  guide: {
    label: string;
    title: string;
    steps: readonly {
      title: string;
      description: string;
    }[];
  };
  faq: {
    title: string;
    items: readonly {
      question: string;
      answer: string;
    }[];
  };
};

type CalculatorHomeContent = Readonly<Record<string, CalculatorHomeCopy>>;

export function resolveCalculatorHomeCopy(
  homeContent: unknown,
  locale: string
): CalculatorHomeCopy {
  const content = homeContent as CalculatorHomeContent | null;
  const copy = content?.[locale] ?? content?.en;
  if (!copy) {
    throw new Error('401k-calculator requires localized home content');
  }

  return copy;
}
