import handler, { createServerEntry } from '@tanstack/react-start/server-entry';

import { runWithTanStackCloudflareBindings } from './server/cloudflare-bindings';

export default createServerEntry({
  fetch(request) {
    return runWithTanStackCloudflareBindings(() => handler.fetch(request));
  },
});
