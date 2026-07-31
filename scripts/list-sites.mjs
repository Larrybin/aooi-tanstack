import { listConfiguredSiteKeys } from './lib/site-config.mjs';

process.stdout.write(`${JSON.stringify(listConfiguredSiteKeys())}\n`);
