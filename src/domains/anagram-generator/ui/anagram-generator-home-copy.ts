export type AnagramGeneratorHomeCopy = {
  metadata: {
    title: string;
    description: string;
    keywords: readonly string[];
  };
  shell: {
    generator: string;
    examples: string;
    howTo: string;
    limitations: string;
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
    tags: readonly string[];
    noteTitle: string;
    note: string;
  };
  workbench: {
    workspaceLabel: string;
    inputTitle: string;
    inputLabel: string;
    inputHelp: string;
    inputPlaceholder: string;
    characterCount: string;
    dictionaryLabel: string;
    dictionaries: {
      common: string;
      games: string;
      phrases: string;
    };
    maxWordsLabel: string;
    maxWordsOptions: readonly string[];
    minimumLengthLabel: string;
    mustIncludeLabel: string;
    optionalLabel: string;
    mustIncludePlaceholder: string;
    mustIncludeHelp: string;
    excludeWordsLabel: string;
    excludeWordsPlaceholder: string;
    excludeWordsHelp: string;
    resultLimitLabel: string;
    generateAction: string;
    sampleAction: string;
    clearAction: string;
    resultsTitle: string;
    copyAllAction: string;
    downloadAction: string;
    emptyTitle: string;
    emptyDescription: string;
    noResultsTitle: string;
    noResultsDescription: string;
    populatedTitle: string;
    resultSummary: string;
    groupSummary: string;
    copyGroupAction: string;
    copyGroupStatus: string;
    copyAllStatus: string;
    copyErrorStatus: string;
    downloadStatus: string;
  };
  examples: {
    label: string;
    title: string;
    description: string;
    items: readonly string[];
  };
  howTo: {
    label: string;
    title: string;
    description: string;
    steps: readonly {
      title: string;
      description: string;
    }[];
  };
  limitations: {
    label: string;
    title: string;
    description: string;
    items: readonly string[];
  };
  guides: readonly {
    title: string;
    paragraphs: readonly string[];
  }[];
  faq: {
    label: string;
    title: string;
    items: readonly {
      question: string;
      answer: string;
    }[];
  };
};

type HomeContent = Readonly<Record<string, AnagramGeneratorHomeCopy>>;

export function resolveAnagramGeneratorHomeCopy(
  homeContent: unknown,
  locale: string
): AnagramGeneratorHomeCopy {
  const content = homeContent as HomeContent | null;
  const copy = content?.[locale] ?? content?.en;

  if (!copy) {
    throw new Error('anagram-generator requires localized home content');
  }

  return copy;
}
