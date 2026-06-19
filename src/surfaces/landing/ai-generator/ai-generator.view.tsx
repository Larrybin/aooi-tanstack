import { ImageGenerator, MusicGenerator } from '@/domains/ai/ui';
import type { AiGeneratorRouteData } from '@/server/ai/ai-generator-route-resolver';

import { PageHeader } from '@/shared/blocks/common/page-header';

import { LandingShellView } from '../shell/landing-shell.view';

export function AiGeneratorRouteView({ data }: { data: AiGeneratorRouteData }) {
  return (
    <LandingShellView shell={data.shell}>
      <PageHeader
        title={data.page.title}
        description={data.page.description}
        className="mt-16 -mb-32"
      />
      {data.kind === 'image' ? (
        <ImageGenerator
          locale={data.locale}
          messages={data.generatorMessages}
          srOnlyTitle={data.generatorTitle}
        />
      ) : (
        <MusicGenerator
          locale={data.locale}
          messages={data.generatorMessages}
          srOnlyTitle={data.generatorTitle}
        />
      )}
    </LandingShellView>
  );
}

export function AiDemoRouteView({ data }: { data: AiGeneratorRouteData }) {
  return (
    <LandingShellView shell={data.shell}>
      <PageHeader
        title={data.page.title}
        description={data.page.description}
        className="mt-16"
      />
    </LandingShellView>
  );
}
