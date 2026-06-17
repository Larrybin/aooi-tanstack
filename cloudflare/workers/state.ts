export { StatefulLimitersDurableObject } from './stateful-limiters';

const stateWorker = {
  fetch() {
    return new Response('Not Found', { status: 404 });
  },
};

export default stateWorker;
