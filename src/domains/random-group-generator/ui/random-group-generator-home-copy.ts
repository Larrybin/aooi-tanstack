export type RandomGroupGeneratorHomeCopy = {
  metadata: {
    title: string;
    description: string;
    keywords: readonly string[];
  };
  shell: {
    generator: string;
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
    eyebrow: string;
    title: string;
    description: string;
    noteTitle: string;
    noteDescription: string;
  };
  workbench: {
    rosterTitle: string;
    rosterDescription: string;
    namesLabel: string;
    namesPlaceholder: string;
    namesReady: string;
    sampleAction: string;
    sampleNames: readonly string[];
    splitTitle: string;
    splitDescription: string;
    splitMethod: string;
    groupCountMode: string;
    groupSizeMode: string;
    groupCountLabel: string;
    groupSizeLabel: string;
    groupLabel: string;
    defaultGroupLabel: string;
    decreaseCountLabel: string;
    increaseCountLabel: string;
    generateAction: string;
    reshuffleAction: string;
    resetAction: string;
    resultsTitle: string;
    emptyResult: string;
    copyAction: string;
    csvAction: string;
    printAction: string;
    emptySummary: string;
    groupCountSummary: string;
    groupSizeSummary: string;
    emptyError: string;
    initialStatus: string;
    copiedStatus: string;
    copyError: string;
    csvStatus: string;
    printStatus: string;
    resultStatus: string;
    equalBalanceStatus: string;
    unevenBalanceStatus: string;
    reviewNote: string;
  };
  howTo: {
    label: string;
    title: string;
    steps: readonly {
      title: string;
      description: string;
    }[];
  };
  guides: readonly {
    title: string;
    paragraphs: readonly string[];
    points?: readonly string[];
  }[];
  examples: {
    label: string;
    title: string;
    items: readonly {
      title: string;
      description: string;
    }[];
  };
  faq: {
    label: string;
    title: string;
    items: readonly {
      question: string;
      answer: string;
    }[];
  };
};

type HomeContent = Readonly<Record<string, RandomGroupGeneratorHomeCopy>>;

export function resolveRandomGroupGeneratorHomeCopy(
  homeContent: unknown,
  locale: string
): RandomGroupGeneratorHomeCopy {
  const content = homeContent as HomeContent | null;
  const copy = content?.[locale] ?? content?.en;

  if (!copy) {
    throw new Error('random-group-generator requires localized home content');
  }

  return copy;
}
