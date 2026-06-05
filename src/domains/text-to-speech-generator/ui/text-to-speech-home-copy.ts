export type TextToSpeechGeneratorHomeCopy = {
  metadata: {
    title: string;
    description: string;
    keywords: readonly string[];
  };
  shell: {
    pricing: string;
    billing: string;
    footerDescription: string;
    productGroup: string;
    tool: string;
    trustGroup: string;
    privacyPolicy: string;
    termsOfService: string;
    copyrightSuffix: string;
  };
  hero: {
    badge: string;
    title: string;
    description: string;
    trustNotes: readonly string[];
  };
  generator: {
    sampleText: string;
    textLabel: string;
    languageLabel: string;
    voiceLabel: string;
    speedLabel: string;
    characters: string;
    generatePreview: string;
    generatingPreview: string;
    previewReady: string;
    previewError: string;
    downloadMp3: string;
    signInToDownload: string;
    quotaTitle: string;
    quotaRemaining: string;
    extraCredits: string;
    resets: string;
    previewsPerDay: string;
    recentHistory: string;
    historyEmpty: string;
    audioTitle: string;
    audioEmpty: string;
  };
  sections: {
    workflow: {
      eyebrow: string;
      title: string;
      description: string;
      items: readonly string[];
    };
    privacy: {
      title: string;
      description: string;
    };
    limits: {
      title: string;
      description: string;
    };
  };
};

type TextToSpeechGeneratorHomeContent = Readonly<
  Record<string, TextToSpeechGeneratorHomeCopy>
>;

export function resolveTextToSpeechGeneratorHomeCopy(
  homeContent: unknown,
  locale: string
): TextToSpeechGeneratorHomeCopy {
  const content = homeContent as TextToSpeechGeneratorHomeContent | null;
  const copy = content?.[locale] ?? content?.en;
  if (!copy) {
    throw new Error('text-to-speech-generator requires localized home content');
  }

  return copy;
}
