import type { ProductActor } from '@/domains/product-access/domain/actor';
import type { ProductOwner } from '@/domains/product-access/domain/ownership';

export type RemoverActor =
  | (Extract<ProductActor, { kind: 'user' }> & {
      productId?: string | null;
      entitlements?: Record<string, string | number | boolean>;
      entitlementGrantIds?: string[];
    })
  | (Extract<ProductActor, { kind: 'anonymous' }> & {
      productId?: null;
    });

export type RemoverOwner = ProductOwner;

export type RemoverImageAssetKind =
  | 'original'
  | 'mask'
  | 'output'
  | 'thumbnail';
export type RemoverImageAssetStatus = 'active' | 'deleted';
export type RemoverJobStatus = 'queued' | 'processing' | 'succeeded' | 'failed';
export type RemoverQuotaType = 'processing' | 'high_res_download' | 'upload';
export type RemoverQuotaReservationStatus =
  | 'reserved'
  | 'committed'
  | 'refunded';

export type RemoverPlanLimits = {
  productId: string;
  processingLimit: number;
  processingWindow: 'day' | 'month';
  highResDownloads: number;
  highResDownloadWindow: 'lifetime' | 'month';
  maxUploadMb: number;
  retentionDays: number;
  lowResDownload: boolean;
  advancedMode: boolean;
  priorityQueue: boolean;
};

export type RemoverQuotaReservationLike = {
  status: RemoverQuotaReservationStatus;
};
