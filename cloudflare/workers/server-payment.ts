import { createServerWorker } from './create-server-worker';

export default createServerWorker(() => import('../../dist/server/server.mjs'));
