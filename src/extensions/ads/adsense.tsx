import { AdsenseSlot } from './adsense-slot';
import type { AdsProvider, AdsZoneContext, AdsZoneName } from './types';

export interface AdsenseConfigs {
  clientId: string;
  slotIds: Partial<Record<AdsZoneName, string>>;
}

export class AdsenseProvider implements AdsProvider {
  readonly name = 'adsense';

  constructor(private readonly configs: AdsenseConfigs) {}

  getHeadScripts() {
    return (
      <script
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.configs.clientId}`}
        crossOrigin="anonymous"
      />
    );
  }

  getBodyScripts() {
    return null;
  }

  getMetaTags() {
    return (
      <meta
        key={this.name}
        name="google-adsense-account"
        content={this.configs.clientId}
      />
    );
  }

  private getSlot(zone: AdsZoneName) {
    return this.configs.slotIds[zone] || '';
  }

  supportsZone(zone: AdsZoneName): boolean {
    return Boolean(this.getSlot(zone));
  }

  renderZone(context: AdsZoneContext) {
    const slot = this.getSlot(context.zone);
    if (!slot) {
      return null;
    }

    return <AdsenseSlot clientId={this.configs.clientId} slot={slot} />;
  }

  getAdsTxtEntry(): string | null {
    const publisherId = this.configs.clientId.replace(/^ca-/, '').trim();
    if (!publisherId) {
      return null;
    }

    return `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0`;
  }
}
