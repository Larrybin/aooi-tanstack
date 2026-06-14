import type { ActionResult } from '@/shared/lib/action/result';
import type {
  SelfUserDetails,
  UserCreditsSummary,
} from '@/shared/types/auth-session';

type AccountActionResult = ActionResult;

export const ACCOUNT_APIKEY_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted',
} as const;

export type AccountApikeyStatus =
  (typeof ACCOUNT_APIKEY_STATUS)[keyof typeof ACCOUNT_APIKEY_STATUS];

export const ACCOUNT_CREDIT_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  DELETED: 'deleted',
} as const;

export type AccountCreditStatus =
  (typeof ACCOUNT_CREDIT_STATUS)[keyof typeof ACCOUNT_CREDIT_STATUS];

export const ACCOUNT_CREDIT_TRANSACTION_TYPE = {
  GRANT: 'grant',
  CONSUME: 'consume',
} as const;

export type AccountCreditTransactionType =
  (typeof ACCOUNT_CREDIT_TRANSACTION_TYPE)[keyof typeof ACCOUNT_CREDIT_TRANSACTION_TYPE];

type AccountCreditsSummary = {
  remainingCredits: number;
  expiresAt: string | null;
} | null;

type AccountSubscriptionSummary = {
  productId?: string | null;
} | null;

type AccountPermissionDeps = {
  hasPermission: (userId: string, permission: string) => Promise<boolean>;
};

type AccountCreditsDeps = {
  getRemainingCreditsSummary: (
    userId: string
  ) => Promise<AccountCreditsSummary>;
  getRemainingCredits: (userId: string) => Promise<number>;
  getCredits: (params: {
    userId: string;
    status: AccountCreditStatus;
    transactionType?: AccountCreditTransactionType;
    page: number;
    limit: number;
  }) => Promise<AccountCreditRecord[]>;
  getCreditsCount: (params: {
    userId: string;
    status: AccountCreditStatus;
    transactionType?: AccountCreditTransactionType;
  }) => Promise<number>;
};

type AccountProfileDeps = {
  updateUser: (
    userId: string,
    updatedUser: {
      name?: string;
      image?: string;
    }
  ) => Promise<unknown>;
};

type AdminUsersDeps = {
  getUsers: (params: {
    email?: string;
    page: number;
    limit: number;
  }) => Promise<AccountAdminUserRecord[]>;
  getUsersCount: (params: { email?: string }) => Promise<number>;
  getRemainingCredits: (userId: string) => Promise<number>;
};

export type AccountApikeyRecord = {
  id: string;
  userId: string;
  title?: string | null;
  key?: string | null;
  status?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
};

export type AccountCreditRecord = {
  id: string;
  userId: string;
  transactionNo?: string | null;
  description?: string | null;
  transactionType?: string | null;
  transactionScene?: string | null;
  credits?: number | null;
  expiresAt?: Date | null;
  createdAt?: Date | null;
};

export type AccountAdminUserRole = {
  id: string;
  title?: string | null;
};

export type AccountAdminUserRecord = {
  id: string;
  name?: string | null;
  image?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  createdAt?: Date | null;
  roles?: AccountAdminUserRole[];
  remainingCredits?: number;
};

type AccountApikeyDeps = {
  getApikeys: (params: {
    userId: string;
    status: AccountApikeyStatus;
    page: number;
    limit: number;
  }) => Promise<AccountApikeyRecord[]>;
  getApikeysCount: (params: {
    userId: string;
    status: AccountApikeyStatus;
  }) => Promise<number>;
  findApikeyById: (id: string) => Promise<AccountApikeyRecord | undefined>;
  createApikey: (record: {
    id: string;
    userId: string;
    title: string;
    key: string;
    status: AccountApikeyStatus;
  }) => Promise<AccountApikeyRecord>;
  updateApikey: (
    id: string,
    update: {
      title?: string;
      status?: AccountApikeyStatus;
      deletedAt?: Date;
    }
  ) => Promise<AccountApikeyRecord>;
  createId: () => string;
  createSecretKey: () => string;
};

type ReadSelfUserDetailsDeps = AccountPermissionDeps &
  Pick<AccountCreditsDeps, 'getRemainingCreditsSummary'> & {
    getCurrentSubscription: (
      userId: string
    ) => Promise<AccountSubscriptionSummary>;
  };

const ADMIN_ACCESS_PERMISSION = 'admin.access';
export const ACCOUNT_APIKEY_ACTIVE_STATUS = 'active';
export const ACCOUNT_APIKEY_DELETED_STATUS = 'deleted';
export const ACCOUNT_CREDIT_ACTIVE_STATUS = 'active';
const ACCOUNT_APIKEY_ACTIVE_ENUM = ACCOUNT_APIKEY_STATUS.ACTIVE;
const ACCOUNT_APIKEY_DELETED_ENUM = ACCOUNT_APIKEY_STATUS.DELETED;
const ACCOUNT_CREDIT_ACTIVE_ENUM = ACCOUNT_CREDIT_STATUS.ACTIVE;

function actionOk(message: string, redirectUrl?: string): AccountActionResult {
  return {
    status: 'success',
    message,
    redirect_url: redirectUrl,
  };
}

function toCreditsSummary(
  value: AccountCreditsSummary
): UserCreditsSummary | null {
  if (!value) {
    return null;
  }

  return {
    remainingCredits: value.remainingCredits,
    expiresAt: value.expiresAt,
  };
}

export async function readSelfUserDetailsUseCase(
  userId: string,
  deps: ReadSelfUserDetailsDeps
): Promise<SelfUserDetails> {
  const [isAdmin, credits, currentSubscription] = await Promise.all([
    deps.hasPermission(userId, ADMIN_ACCESS_PERMISSION),
    deps.getRemainingCreditsSummary(userId),
    deps.getCurrentSubscription(userId),
  ]);

  return {
    isAdmin,
    credits: toCreditsSummary(credits),
    currentSubscriptionProductId: currentSubscription?.productId ?? null,
  };
}

export async function readAccountCreditsSummaryUseCase(
  userId: string,
  deps: Pick<AccountCreditsDeps, 'getRemainingCreditsSummary'>
) {
  return deps.getRemainingCreditsSummary(userId);
}

export async function readAccountRemainingCreditsUseCase(
  userId: string,
  deps: Pick<AccountCreditsDeps, 'getRemainingCredits'>
) {
  return deps.getRemainingCredits(userId);
}

export async function listOwnCreditsUseCase(
  input: {
    userId: string;
    transactionType?: AccountCreditTransactionType;
    page: number;
    limit: number;
  },
  deps: Pick<AccountCreditsDeps, 'getCredits' | 'getCreditsCount'>
) {
  const [data, total] = await Promise.all([
    deps.getCredits({
      userId: input.userId,
      status: ACCOUNT_CREDIT_ACTIVE_ENUM,
      transactionType: input.transactionType,
      page: input.page,
      limit: input.limit,
    }),
    deps.getCreditsCount({
      userId: input.userId,
      status: ACCOUNT_CREDIT_ACTIVE_ENUM,
      transactionType: input.transactionType,
    }),
  ]);

  return {
    data,
    total,
    page: input.page,
    limit: input.limit,
  };
}

export async function updateProfileUseCase(
  input: {
    userId: string;
    name: string;
    image: string;
  },
  deps: AccountProfileDeps,
  successMessage: string,
  redirectUrl: string
): Promise<AccountActionResult> {
  await deps.updateUser(input.userId, {
    name: input.name,
    image: input.image,
  });

  return actionOk(successMessage, redirectUrl);
}

export async function listOwnApikeysUseCase(
  input: {
    userId: string;
    page: number;
    limit: number;
  },
  deps: Pick<AccountApikeyDeps, 'getApikeys' | 'getApikeysCount'>
) {
  const [data, total] = await Promise.all([
    deps.getApikeys({
      userId: input.userId,
      status: ACCOUNT_APIKEY_ACTIVE_ENUM,
      page: input.page,
      limit: input.limit,
    }),
    deps.getApikeysCount({
      userId: input.userId,
      status: ACCOUNT_APIKEY_ACTIVE_ENUM,
    }),
  ]);

  return {
    data,
    total,
    page: input.page,
    limit: input.limit,
  };
}

export async function requireOwnedApikeyUseCase(
  input: {
    apikeyId: string;
    userId: string;
  },
  deps: Pick<AccountApikeyDeps, 'findApikeyById'>
) {
  const apikey = await deps.findApikeyById(input.apikeyId);
  if (!apikey) {
    return null;
  }

  if (apikey.userId !== input.userId) {
    return null;
  }

  return apikey;
}

export async function createOwnApikeyUseCase(
  input: {
    userId: string;
    title: string;
  },
  deps: Pick<
    AccountApikeyDeps,
    'createApikey' | 'createId' | 'createSecretKey'
  >,
  successMessage: string,
  redirectUrl: string
): Promise<AccountActionResult> {
  await deps.createApikey({
    id: deps.createId(),
    userId: input.userId,
    title: input.title,
    key: deps.createSecretKey(),
    status: ACCOUNT_APIKEY_ACTIVE_ENUM,
  });

  return actionOk(successMessage, redirectUrl);
}

export async function renameOwnApikeyUseCase(
  input: {
    apikeyId: string;
    userId: string;
    title: string;
  },
  deps: Pick<AccountApikeyDeps, 'findApikeyById' | 'updateApikey'>,
  successMessage: string,
  redirectUrl: string
): Promise<AccountActionResult | null> {
  const apikey = await requireOwnedApikeyUseCase(input, deps);
  if (!apikey) {
    return null;
  }

  await deps.updateApikey(apikey.id, { title: input.title });
  return actionOk(successMessage, redirectUrl);
}

export async function deleteOwnApikeyUseCase(
  input: {
    apikeyId: string;
    userId: string;
  },
  deps: Pick<AccountApikeyDeps, 'findApikeyById' | 'updateApikey'>,
  successMessage: string,
  redirectUrl: string
): Promise<AccountActionResult | null> {
  const apikey = await requireOwnedApikeyUseCase(input, deps);
  if (!apikey) {
    return null;
  }

  await deps.updateApikey(apikey.id, {
    status: ACCOUNT_APIKEY_DELETED_ENUM,
    deletedAt: new Date(),
  });
  return actionOk(successMessage, redirectUrl);
}

export async function listAdminUsersUseCase(
  input: {
    email?: string;
    page: number;
    limit: number;
  },
  deps: AdminUsersDeps & AccountPermissionDeps
) {
  const [users, total] = await Promise.all([
    deps.getUsers({
      email: input.email,
      page: input.page,
      limit: input.limit,
    }),
    deps.getUsersCount({
      email: input.email,
    }),
  ]);

  const rows = await Promise.all(
    users.map(async (user) => ({
      ...user,
      roles: user.roles ?? [],
      remainingCredits: await deps.getRemainingCredits(user.id),
    }))
  );

  return { rows, total };
}
