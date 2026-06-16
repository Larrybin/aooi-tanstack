import type { ReactNode } from 'react';

import type { CustomerServiceConfigs, CustomerServiceProvider } from './types';

/**
 * Crisp customer service configs
 * @docs https://docs.crisp.chat/
 */
export interface CrispCustomerServiceConfigs extends CustomerServiceConfigs {
  websiteId: string; // website id
}

/**
 * Crisp customer service provider
 * @website https://crisp.chat/
 */
export class CrispCustomerServiceProvider implements CustomerServiceProvider {
  readonly name = 'crisp';

  configs: CrispCustomerServiceConfigs;

  constructor(configs: CrispCustomerServiceConfigs) {
    this.configs = configs;
  }

  getHeadScripts(): ReactNode {
    return (
      <>
        <script
          id={`${this.name}-script`}
          dangerouslySetInnerHTML={{
            __html: `
                window.$crisp=[];
                window.CRISP_WEBSITE_ID="${this.configs.websiteId}";
                (function(){
                  d=document;
                  s=d.createElement("script");
                  s.src="https://client.crisp.chat/l.js";
                  s.async=1;
                  d.getElementsByTagName("head")[0].appendChild(s);
                })();
            `,
          }}
        />
      </>
    );
  }
}
