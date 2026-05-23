export type ProductActorKind = 'user' | 'anonymous';

export type ProductActor =
  | {
      kind: 'user';
      userId: string;
      anonymousSessionId?: string | null;
    }
  | {
      kind: 'anonymous';
      userId?: null;
      anonymousSessionId: string;
    };
