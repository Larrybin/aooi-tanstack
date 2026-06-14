import { readSelfUserDetailsUseCase } from '@/domains/account/application/use-cases';

import { jsonOk } from '@/shared/lib/api/response';

type UserSelfDetailsApiContext = {
  requireUser(): Promise<{ id: string }>;
};

type UserSelfDetailsDeps = Parameters<typeof readSelfUserDetailsUseCase>[1];

type UserSelfDetailsActionDeps = UserSelfDetailsDeps & {
  createApiContext: (req: Request) => UserSelfDetailsApiContext;
};

export function createUserSelfDetailsPostAction(
  deps: UserSelfDetailsActionDeps
) {
  return async (req: Request) => {
    const user = await deps.createApiContext(req).requireUser();
    const details = await readSelfUserDetailsUseCase(user.id, deps);

    return jsonOk(details, { headers: { 'Cache-Control': 'no-store' } });
  };
}
