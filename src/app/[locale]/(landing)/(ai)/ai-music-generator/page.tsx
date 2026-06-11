// data: request locale (next-intl) + landing translations (FAQ/CTA) + music generator widget (client)
// cache: default (no request-bound auth; no explicit fetch)
// reason: public interactive page; keep server output cache-friendly
import { MusicGenerator } from '@/domains/ai/ui';
import { getMetadata } from '@/app/_metadata/public-page-metadata';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/shared/blocks/common/page-header';
import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import { CTA, FAQ } from '@/themes/default/blocks';

export const generateMetadata = getMetadata({
  metadataKey: 'ai.music.metadata',
  canonicalUrl: '/ai-music-generator',
});

export default async function AiMusicGeneratorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('landing');
  const tt = await getTranslations('ai.music');

  return (
    <ScopedIntlProvider locale={locale} namespaces={['ai.music']}>
      <>
        <PageHeader
          title={tt.raw('page.title')}
          description={tt.raw('page.description')}
          className="mt-16 -mb-32"
        />
        <MusicGenerator srOnlyTitle={tt.raw('generator.title')} />
        <FAQ faq={t.raw('faq')} />
        <CTA cta={t.raw('cta')} className="bg-muted" />
      </>
    </ScopedIntlProvider>
  );
}
