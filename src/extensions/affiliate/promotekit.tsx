import type { ReactNode } from 'react';

import type { AffiliateConfigs, AffiliateProvider } from './types';

/**
 * PromoteKit affiliate configs
 * @docs https://docs.promotekit.com/
 */
export interface PromoteKitAffiliateConfigs extends AffiliateConfigs {
  promotekitId: string; // promotekit id
}

/**
 * PromoteKit affiliate provider
 * @website https://promotekit.com/
 */
export class PromoteKitAffiliateProvider implements AffiliateProvider {
  readonly name = 'promotekit';

  configs: PromoteKitAffiliateConfigs;

  constructor(configs: PromoteKitAffiliateConfigs) {
    this.configs = configs;
  }

  getHeadScripts(): ReactNode {
    return (
      <>
        <script
          id={`${this.name}-script`}
          async
          defer
          src="https://cdn.promotekit.com/promotekit.js"
          data-promotekit={this.configs.promotekitId}
        />
      </>
    );
  }
}
