import { createServerWorker } from './create-server-worker';

export default createServerWorker(
  () => import('../../dist/server/entry.server.mjs')
);
