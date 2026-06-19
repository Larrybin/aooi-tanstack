'use client';

import { useEffect, useMemo, useReducer, useRef } from 'react';
import { IconUpload, IconX } from '@tabler/icons-react';
import { ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { fetchApiData, isPlainObject } from '@/shared/lib/api/client';
import { toastFetchError } from '@/shared/lib/api/fetch-json';
import { useTranslations } from '@/shared/lib/i18n/native-react';
import { cn } from '@/shared/lib/utils';

import { AppImage } from './app-image';

export type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

export interface ImageUploaderValue {
  id: string;
  preview: string;
  url?: string;
  value?: string;
  status: UploadStatus;
  size?: number;
}

interface ImageUploaderProps {
  allowMultiple?: boolean;
  maxImages?: number;
  maxSizeMB?: number;
  accept?: string;
  title?: string;
  emptyHint?: string;
  className?: string;
  defaultItems?: Array<{ preview: string; value: string }>;
  onChange?: (items: ImageUploaderValue[]) => void;
}

interface UploadItem extends ImageUploaderValue {
  file?: File;
}

type ItemsAction =
  | UploadItem[]
  | ((currentItems: UploadItem[]) => UploadItem[]);

const formatBytes = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

export function ImageUploader({
  allowMultiple = false,
  maxImages = 1,
  maxSizeMB = 10,
  accept = 'image/*,.ico',
  title,
  emptyHint,
  className,
  defaultItems,
  onChange,
}: ImageUploaderProps) {
  const t = useTranslations('common.uploader.image');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const isInitializedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const isInternalChangeRef = useRef(false);
  const itemsRef = useRef<UploadItem[]>([]);

  const [items, dispatchItems] = useReducer(
    (currentItems: UploadItem[], action: ItemsAction) =>
      typeof action === 'function' ? action(currentItems) : action,
    defaultItems,
    (initialDefaultItems = []) =>
      initialDefaultItems.map(({ preview, value }, index) => ({
        id: `preset-${value || preview}-${index}`,
        preview,
        url: preview,
        value,
        status: 'uploaded' as UploadStatus,
      }))
  );

  const maxCount = allowMultiple ? maxImages : 1;
  const maxBytes = maxSizeMB * 1024 * 1024;

  const uploadImageFile = async (file: File) => {
    const formData = new FormData();
    formData.append('files', file);

    const data = await fetchApiData<{
      results: Array<{ key: string; url: string }>;
    }>(
      '/api/storage/upload-image',
      { method: 'POST', body: formData },
      {
        validate: (
          value
        ): value is {
          results: Array<{ key: string; url: string }>;
        } =>
          isPlainObject(value) &&
          Array.isArray((value as { results?: unknown }).results) &&
          isPlainObject((value as { results: unknown[] }).results[0]) &&
          typeof (value as { results: Array<{ key?: unknown; url?: unknown }> })
            .results[0]?.key === 'string' &&
          typeof (value as { results: Array<{ key?: unknown; url?: unknown }> })
            .results[0]?.url === 'string',
        invalidDataMessage: t('invalid_upload_response'),
      }
    );

    return {
      key: data.results[0].key.trim(),
      url: data.results[0].url.trim(),
    };
  };

  // 保持最新 items 引用（用于卸载时清理 blob URL）
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // 更新 onChange ref
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!isInitializedRef.current) {
      return;
    }

    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    const normalizedDefaultItems = defaultItems || [];

    dispatchItems((currentItems) => {
      const currentValues = currentItems
        .filter((item) => item.status === 'uploaded' && item.url)
        .map((item) => item.value || item.url || '');

      const isSame =
        normalizedDefaultItems.length === currentValues.length &&
        normalizedDefaultItems.every(
          (item, index) => item.value === currentValues[index]
        );

      if (!isSame) {
        currentItems.forEach((item) => {
          if (item.preview.startsWith('blob:')) {
            URL.revokeObjectURL(item.preview);
          }
        });

        return normalizedDefaultItems.map(({ preview, value }, index) => ({
          id: `preset-${value || preview}-${index}`,
          preview,
          url: preview,
          value,
          status: 'uploaded' as UploadStatus,
        }));
      }

      return currentItems;
    });
  }, [defaultItems]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }

    isInternalChangeRef.current = true;

    onChangeRef.current?.(
      items.map(({ id, preview, url, value, status, size }) => ({
        id,
        preview,
        url,
        value,
        status,
        size,
      }))
    );
  }, [items]);

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) {
      return;
    }

    const availableSlots = maxCount - items.length;
    if (availableSlots <= 0) {
      toast.error(t('max_images_reached'));
      return;
    }

    const filesToAdd = selectedFiles.slice(0, availableSlots).filter((file) => {
      if (file.size > maxBytes) {
        toast.error(
          t('file_too_large', { name: file.name, maxSize: maxSizeMB })
        );
        return false;
      }
      return true;
    });

    if (!filesToAdd.length) {
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      return;
    }

    const newItems = filesToAdd.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      preview: URL.createObjectURL(file),
      file,
      size: file.size,
      status: 'uploading' as UploadStatus,
    }));

    dispatchItems((prev) => [...prev, ...newItems]);

    // Upload in parallel
    Promise.all(
      newItems.map(async (item) => {
        try {
          const result = await uploadImageFile(item.file as File);
          dispatchItems((prev) => {
            const next = prev.map((current) => {
              if (current.id === item.id) {
                if (current.preview.startsWith('blob:')) {
                  URL.revokeObjectURL(current.preview);
                }
                return {
                  ...current,
                  preview: result.url,
                  url: result.url,
                  value: result.key,
                  status: 'uploaded' as UploadStatus,
                  file: undefined,
                };
              }
              return current;
            });
            return next;
          });
        } catch (error: unknown) {
          console.error('Upload failed:', error);
          toastFetchError(
            error,
            error instanceof Error && error.message
              ? t('upload_failed_with_reason', { reason: error.message })
              : t('upload_failed')
          );
          dispatchItems((prev) => {
            const next = prev.map((current) =>
              current.id === item.id
                ? { ...current, status: 'error' as UploadStatus }
                : current
            );
            return next;
          });
        }
      })
    );

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemove = (id: string) => {
    dispatchItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      const removed = prev.find((item) => item.id === id);
      if (removed?.preview.startsWith('blob:')) {
        URL.revokeObjectURL(removed.preview);
      }
      return next;
    });
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const countLabel = useMemo(
    () => `${items.length}/${maxCount}`,
    [items.length, maxCount]
  );

  return (
    <div className={cn('space-y-4', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={allowMultiple}
        onChange={handleSelect}
        className="hidden"
      />

      {title && (
        <div className="text-foreground flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-primary h-4 w-4" />
            <span>{title}</span>
            <span className="text-primary text-xs">({countLabel})</span>
          </div>
        </div>
      )}

      <div
        className={cn(
          'flex flex-wrap gap-4',
          allowMultiple ? 'flex-wrap' : 'flex-nowrap'
        )}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="group border-border bg-muted/50 hover:border-border hover:bg-muted relative overflow-hidden rounded-xl border p-1 shadow-sm transition"
          >
            <div className="relative overflow-hidden rounded-lg">
              <AppImage
                src={item.preview}
                alt={t('reference_alt')}
                className="h-32 w-32 rounded-lg object-cover"
                width={128}
                height={128}
              />
              {item.size && (
                <span className="bg-background text-muted-foreground absolute bottom-2 left-2 rounded-md px-2 py-1 text-[10px] font-medium">
                  {formatBytes(item.size)}
                </span>
              )}
              {item.status === 'uploading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-medium text-white">
                  {t('status.uploading')}
                </div>
              )}
              {item.status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-500/70 text-xs font-medium text-white">
                  {t('status.failed')}
                </div>
              )}
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => handleRemove(item.id)}
              >
                <IconX className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {items.length < maxCount && (
          <div className="group border-border bg-muted/50 hover:border-border hover:bg-muted relative overflow-hidden rounded-xl border border-dashed p-1 shadow-sm transition">
            <div className="relative overflow-hidden rounded-lg">
              <button
                type="button"
                className="flex h-32 w-32 flex-col items-center justify-center gap-2"
                onClick={openFilePicker}
              >
                <div className="border-border flex h-10 w-10 items-center justify-center rounded-full border border-dashed">
                  <IconUpload className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">
                  {t('button.upload')}
                </span>
                <span className="text-primary text-xs">
                  {t('max_size', { maxSize: maxSizeMB })}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {!title && (
        <div className="text-muted-foreground text-xs">{emptyHint}</div>
      )}
    </div>
  );
}
