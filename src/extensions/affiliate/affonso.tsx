import type { ReactNode } from 'react';

import type { AffiliateConfigs, AffiliateProvider } from './types';

/**
 * Affonso affiliate configs
 * @docs https://affonso.io/help/getting-started/overview
 */
export interface AffonsoAffiliateConfigs extends AffiliateConfigs {
  affonsoId: string; // affonso id
  cookieDuration?: number; // cookie duration in days, default is 30 days
}

/**
 * Affonso affiliate provider
 * @website https://affonso.io/
 */
export class AffonsoAffiliateProvider implements AffiliateProvider {
  readonly name = 'affonso';

  configs: AffonsoAffiliateConfigs;

  constructor(configs: AffonsoAffiliateConfigs) {
    this.configs = configs;
  }

  getHeadScripts(): ReactNode {
    return (
      <>
        <script
          id={`${this.name}-script`}
          async
          defer
          src="https://affonso.io/js/pixel.min.js"
          data-affonso={this.configs.affonsoId}
          data-cookie_duration={this.configs.cookieDuration ?? 30}
        />
      </>
    );
  }
}
