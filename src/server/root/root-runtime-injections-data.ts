import { createServerFn } from '@tanstack/react-start';

export const loadRootRuntimeInjections = createServerFn({ method: 'GET' })
  .validator(() => ({}))
  .handler(async () => {
    const { resolveRootRuntimeInjectionsForServer } =
      await import('./root-runtime-injections');

    return resolveRootRuntimeInjectionsForServer();
  });
