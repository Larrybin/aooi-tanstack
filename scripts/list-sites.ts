import { listConfiguredSiteKeys } from './lib/site-config.ts';

process.stdout.write(`${JSON.stringify(listConfiguredSiteKeys())}\n`);
