export type Mp4CompressorHomeCopy = {
  metadata: {
    title: string;
    description: string;
    keywords: readonly string[];
  };
  shell: {
    compressor: string;
    howTo: string;
    settings: string;
    faq: string;
    chooseMp4: string;
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
    trustNotes: readonly {
      title: string;
      description: string;
    }[];
  };
  workbench: Mp4CompressorWorkbenchCopy;
  howTo: {
    title: string;
    steps: readonly {
      title: string;
      description: string;
    }[];
  };
  settings: {
    title: string;
    description: string;
    items: readonly {
      title: string;
      label?: string;
      description: string;
      bullets: readonly string[];
    }[];
    note: string;
  };
  faq: {
    title: string;
    items: readonly {
      question: string;
      answer: string;
    }[];
  };
  footerTrust: readonly {
    title: string;
    description: string;
  }[];
};

export type Mp4CompressorWorkbenchCopy = {
  statusComplete: string;
  statusReady: string;
  statusLoading: string;
  statusProcessing: string;
  statusFailed: string;
  demoSuccess: string;
  readyMessage: string;
  loadingMessage: string;
  processingMessage: string;
  original: string;
  compressed: string;
  saved: string;
  downloadMp4: string;
  compressAnother: string;
  chooseFile: string;
  dropHint: string;
  fileHint: string;
  riskHint: string;
  privacyNote: string;
  mode: string;
  bestQuality: string;
  balanced: string;
  smallestFile: string;
  bestQualityHint: string;
  balancedHint: string;
  smallestFileHint: string;
  resolution: string;
  audio: string;
  targetSize: string;
  approximate: string;
  editSettings: string;
  estimatedOutput: string;
  actualMayVary: string;
  startCompress: string;
  cancel: string;
  keep: string;
  reduce: string;
  remove: string;
  invalidTypeError: string;
  openError: string;
  compressError: string;
};

type Mp4CompressorHomeContent = Readonly<Record<string, Mp4CompressorHomeCopy>>;

export function resolveMp4CompressorHomeCopy(
  homeContent: unknown,
  locale: string
): Mp4CompressorHomeCopy {
  const content = homeContent as Mp4CompressorHomeContent | null;
  const copy = content?.[locale] ?? content?.en;
  if (!copy) {
    throw new Error('mp4-compressor requires localized home content');
  }

  return copy;
}
