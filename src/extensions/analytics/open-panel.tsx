import type { ReactNode } from 'react';

import type { AnalyticsConfigs, AnalyticsProvider } from './types';

/**
 * OpenPanel analytics configs
 * @docs https://openpanel.dev/docs/sdks/script
 */
export interface OpenPanelAnalyticsConfigs extends AnalyticsConfigs {
  clientId: string; // openpanel client id
  clientSecret?: string;
  apiUrl?: string;
  trackScreenViews?: boolean;
  trackOutgoingLinks?: boolean;
  trackAttributes?: boolean;
}

/**
 * OpenPanel provider
 * @website https://openpanel.dev/
 */
export class OpenPanelAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'open-panel';

  configs: OpenPanelAnalyticsConfigs;

  constructor(configs: OpenPanelAnalyticsConfigs) {
    this.configs = configs;
  }

  getHeadScripts(): ReactNode {
    return (
      <>
        {/* OpenPanel Analytics */}
        <script
          id={this.name}
          dangerouslySetInnerHTML={{
            __html: `
              window.op = window.op||function(...args){(window.op.q=window.op.q||[]).push(args);};
              window.op('init', {
                clientId: '${this.configs.clientId}',
                trackScreenViews: ${this.configs.trackScreenViews ?? true},
                trackOutgoingLinks: ${this.configs.trackOutgoingLinks ?? true},
                trackAttributes: ${this.configs.trackAttributes ?? true},
              });
            `,
          }}
        />
        <script
          src="https://openpanel.dev/op1.js"
          defer
          async
        />
      </>
    );
  }
}
