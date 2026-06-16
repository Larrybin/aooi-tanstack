import type { ReactNode } from 'react';

import type { AnalyticsConfigs, AnalyticsProvider } from './types';

/**
 * Plausible analytics configs
 * @docs https://plausible.io/docs/integration-guides
 */
export interface PlausibleAnalyticsConfigs extends AnalyticsConfigs {
  domain: string; // data domain
  src: string; // script src
}

/**
 * Plausible provider
 * @website https://plausible.io/
 */
export class PlausibleAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'plausible';

  configs: PlausibleAnalyticsConfigs;

  constructor(configs: PlausibleAnalyticsConfigs) {
    this.configs = configs;
  }

  getHeadScripts(): ReactNode {
    return (
      <>
        {/* Plausible Analytics */}
        <script
          id={this.name}
          dangerouslySetInnerHTML={{
            __html: `
              window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }
            `,
          }}
        />
        <script
          data-domain={this.configs.domain}
          src={this.configs.src}
          defer
          async
        />
      </>
    );
  }
}
