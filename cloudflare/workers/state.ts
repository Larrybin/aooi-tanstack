export { StatefulLimitersDurableObject } from './stateful-limiters';

export class DOQueueHandler {
  fetch() { return new Response('Not Found', { status: 404 }); }
}

export class DOShardedTagCache {
  fetch() { return new Response('Not Found', { status: 404 }); }
}

const stateWorker = {
  fetch() {
    return new Response('Not Found', { status: 404 });
  },
};

export default stateWorker;
