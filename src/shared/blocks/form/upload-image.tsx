'use client';

import { useCallback, useMemo } from 'react';
import type { ControllerRenderProps } from 'react-hook-form';

import type { FormField } from '@/shared/types/blocks/form';

import {
  ImageUploader,
  type ImageUploaderValue,
} from '../common/image-uploader';

interface UploadImageProps {
  field: FormField;
  formField: ControllerRenderProps<Record<string, unknown>, string>;
  data?: Record<string, unknown>;
  metadata?: {
    max?: number;
    maxSizeMB?: number;
    storageValueMode?: string;
  };
  uploadUrl?: string;
  onUpload?: (files: File[]) => Promise<string[]>;
}

export function UploadImage({
  field,
  formField,
  data: _data,
  metadata,
  uploadUrl: _uploadUrl = '/api/storage/upload-image',
  onUpload: _onUpload,
}: UploadImageProps) {
  const maxImages = metadata?.max || 1;
  const maxSizeMB = metadata?.maxSizeMB || 10;
  const allowMultiple = maxImages > 1;
  const accept =
    typeof field.attributes?.accept === 'string'
      ? field.attributes.accept
      : 'image/*,.ico';
  const storageValueMode =
    typeof metadata?.storageValueMode === 'string'
      ? metadata.storageValueMode
      : 'url';

  const defaultItems = useMemo(() => {
    const value = formField.value;
    if (!value) return [];

    let storedValues: string[] = [];

    if (typeof value === 'string') {
      storedValues = value.includes(',')
        ? value.split(',').filter(Boolean)
        : [value];
    } else if (Array.isArray(value)) {
      storedValues = value.map(String);
    }

    return storedValues.map((storedValue) => ({
      value: storedValue,
      preview: storedValue,
    }));
  }, [formField.value]);

  const handleChange = useCallback(
    (items: ImageUploaderValue[]) => {
      const uploadedValues = items
        .filter((item) => item.status === 'uploaded')
        .map((item) =>
          storageValueMode === 'objectKey'
            ? (item.value ?? '')
            : (item.url ?? '')
        )
        .filter(Boolean);

      if (uploadedValues.length > 0) {
        formField.onChange(allowMultiple ? uploadedValues : uploadedValues[0]);
      } else {
        formField.onChange(allowMultiple ? [] : '');
      }
    },
    [formField, allowMultiple, storageValueMode]
  );

  return (
    <ImageUploader
      allowMultiple={allowMultiple}
      maxImages={maxImages}
      maxSizeMB={maxSizeMB}
      accept={accept}
      emptyHint={field.placeholder}
      defaultItems={defaultItems}
      onChange={handleChange}
    />
  );
}
