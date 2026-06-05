import type { ProductActor } from '@/domains/product-access/domain/actor';
import type { ProductAccessContext } from '@/domains/product-entitlements/domain/schema';

export type TextToSpeechActor =
  | (Extract<ProductActor, { kind: 'user' }> & {
      productId?: string | null;
      entitlements?: Record<string, string | number | boolean>;
      entitlementGrantIds?: string[];
      productAccess?: ProductAccessContext;
    })
  | (Extract<ProductActor, { kind: 'anonymous' }> & {
      productId?: null;
      productAccess?: ProductAccessContext;
    });

export type TextToSpeechGenerationStatus = 'generated' | 'expired' | 'deleted';
