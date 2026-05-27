export type RemoverCanvasEditorCopy = {
  brush: string;
  eraser: string;
  pan: string;
  size: string;
  undo: string;
  reset: string;
  zoomOut: string;
  zoomIn: string;
  previewAriaLabel: string;
  replaceImage: string;
  removeReadyTitle: string;
  removeEmptyTitle: string;
  uploading: string;
  removing: string;
  remove: string;
  successTitle: string;
  resultAlt: string;
  downloadLowRes: string;
  signInHighRes: string;
  downloadHighRes: string;
  signInMessage: string;
  signInDownload: string;
  failedTitle: string;
  defaultMaskError: string;
  defaultProcessError: string;
};

export type RemoverEditorCopy = {
  invalidTypeError: string;
  openError: string;
  loading: string;
  uploadTitle: string;
  uploadDescription: string;
  chooseImage: string;
  fileHint: string;
  steps: readonly string[];
  canvas: RemoverCanvasEditorCopy;
};

export type RemoverHomeCopy = {
  metadata: {
    title: string;
    description: string;
    keywords: readonly string[];
  };
  shell: {
    pricing: string;
    myImages: string;
    billing: string;
    footerDescription: string;
    productGroup: string;
    tool: string;
    trustGroup: string;
    privacyPolicy: string;
    termsOfService: string;
    copyrightSuffix: string;
  };
  editor: RemoverEditorCopy;
  hero: {
    badge: string;
    title: string;
    description: string;
    useCases: readonly string[];
  };
  processExample: {
    before: string;
    after: string;
    distraction: string;
    cleanResult: string;
  };
  beforeAfter: {
    eyebrow: string;
    title: string;
    description: string;
  };
  howItWorks: {
    eyebrow: string;
    title: string;
    steps: readonly { title: string; description: string }[];
  };
  useCasesSection: {
    eyebrow: string;
    title: string;
    description: string;
    beforePrefix: string;
    afterPrefix: string;
    examples: readonly { title: string; before: string; after: string }[];
  };
  featuresSection: {
    eyebrow: string;
    title: string;
    features: readonly { title: string; description: string }[];
  };
  privacy: {
    title: string;
    description: string;
  };
  policy: {
    title: string;
    description: string;
  };
  cta: {
    title: string;
    description: string;
    button: string;
  };
  faqSection: {
    eyebrow: string;
    title: string;
    items: readonly { question: string; answer: string }[];
  };
};

export type RemoverHomeContent = Readonly<Record<string, RemoverHomeCopy>>;

export function resolveRemoverHomeCopy(
  homeContent: RemoverHomeContent | null,
  locale: string
): RemoverHomeCopy {
  const copy = homeContent?.[locale] ?? homeContent?.en;
  if (!copy) {
    throw new Error('ai-remover requires localized home content');
  }

  return copy;
}
