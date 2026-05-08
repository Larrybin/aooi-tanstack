import assert from 'node:assert/strict';
import test from 'node:test';

import {
  uploadRemoverAssetsForJob,
  type RemoverUploadAssetInput,
} from './remover-upload-flow';

test('uploadRemoverAssetsForJob uploads the original before the mask', async () => {
  const calls: RemoverUploadAssetInput['kind'][] = [];
  let originalFinished = false;

  const result = await uploadRemoverAssetsForJob({
    image: {
      file: new File(['input'], 'input.png', { type: 'image/png' }),
      url: 'blob:input',
      width: 12,
      height: 8,
    },
    maskBlob: new Blob(['mask'], { type: 'image/png' }),
    uploadAsset: async (input) => {
      calls.push(input.kind);
      assert.equal(input.width, 12);
      assert.equal(input.height, 8);

      if (input.kind === 'original') {
        await Promise.resolve();
        originalFinished = true;
        return { asset: { id: 'input_asset' } };
      }

      assert.equal(originalFinished, true);
      assert.equal(input.file.name, 'ai-remover-mask.png');
      assert.equal(input.file.type, 'image/png');
      return { asset: { id: 'mask_asset' } };
    },
  });

  assert.deepEqual(calls, ['original', 'mask']);
  assert.equal(result.inputUpload.asset.id, 'input_asset');
  assert.equal(result.maskUpload.asset.id, 'mask_asset');
});
