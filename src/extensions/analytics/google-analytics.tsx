import type { ReactNode } from 'react';

import type { AnalyticsConfigs, AnalyticsProvider } from './types';

/**
 * Google analytics configs
 * @docs https://marketingplatform.google.com/about/analytics/
 */
export interface GoogleAnalyticsConfigs extends AnalyticsConfigs {
  gaId: string; // google analytics id
}

/**
 * Google analytics provider
 * @website https://marketingplatform.google.com/about/analytics/
 */
export class GoogleAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'google-analytics';

  configs: GoogleAnalyticsConfigs;

  constructor(configs: GoogleAnalyticsConfigs) {
    this.configs = configs;
  }

  getHeadScripts(): ReactNode {
    return (
      <>
        {/* Google tag (gtag.js) */}
        <script
          src={`https://www.googletagmanager.com/gtag/js?id=${this.configs.gaId}`}
          async
        />
        <script
          id={this.name}
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${this.configs.gaId}');
            `,
          }}
        />
      </>
    );
  }
}
