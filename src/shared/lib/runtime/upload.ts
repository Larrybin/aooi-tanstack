import {
  getRuntimePlatform,
  type RuntimePlatform,
} from '@/infra/runtime/env.server';

import { readRequestFormData } from './request-body';

export const MAX_UPLOAD_REQUEST_BYTES = 20 * 1024 * 1024;

export function isFileUploadValue(value: FormDataEntryValue): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

export async function readUploadRequestInput(
  req: Request,
  fieldName = 'files',
  maxBytes = MAX_UPLOAD_REQUEST_BYTES
): Promise<{
  runtimePlatform: RuntimePlatform;
  formData: FormData;
  entries: FormDataEntryValue[];
  files: File[];
}> {
  const formData = await readRequestFormData(req, maxBytes);
  const entries = formData.getAll(fieldName);

  return {
    runtimePlatform: getRuntimePlatform(),
    formData,
    entries,
    files: entries.filter(isFileUploadValue),
  };
}
