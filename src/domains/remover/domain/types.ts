export type RemoverActor =
  | {
      kind: 'user';
      userId: string;
      anonymousSessionId?: string | null;
      productId?: string | null;
    }
  | {
      kind: 'anonymous';
      userId?: null;
      anonymousSessionId: string;
      productId?: null;
    };

export type RemoverOwner = {
  userId: string | null;
  anonymousSessionId: string | null;
};

export type RemoverImageAssetKind = 'original' | 'mask' | 'output' | 'thumbnail';
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
