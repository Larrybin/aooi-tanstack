import type { UploadedRemoverImage } from './remover-editor-types';

export type RemoverUploadResponse = {
  asset: {
    id: string;
  };
};

export type RemoverUploadAssetInput = {
  file: File;
  kind: 'original' | 'mask';
  width: number;
  height: number;
};

export async function uploadRemoverAssetsForJob({
  image,
  maskBlob,
  uploadAsset,
}: {
  image: UploadedRemoverImage;
  maskBlob: Blob;
  uploadAsset: (
    input: RemoverUploadAssetInput
  ) => Promise<RemoverUploadResponse>;
}): Promise<{
  inputUpload: RemoverUploadResponse;
  maskUpload: RemoverUploadResponse;
}> {
  const inputUpload = await uploadAsset({
    file: image.file,
    kind: 'original',
    width: image.width,
    height: image.height,
  });
  const maskUpload = await uploadAsset({
    file: new File([maskBlob], 'ai-remover-mask.png', {
      type: 'image/png',
    }),
    kind: 'mask',
    width: image.width,
    height: image.height,
  });

  return { inputUpload, maskUpload };
}
