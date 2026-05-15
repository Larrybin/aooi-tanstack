'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import { ImageIcon, Upload } from 'lucide-react';

import type { UploadedRemoverImage } from './remover-editor-types';

const CanvasMaskEditor = lazy(() => import('./remover-canvas-editor'));

export function RemoverEditorEntry() {
  const [image, setImage] = useState<UploadedRemoverImage | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (image?.url) {
        URL.revokeObjectURL(image.url);
      }
    };
  }, [image?.url]);

  async function handleFile(file: File | undefined) {
    setError('');

    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Use a JPG, PNG, or WebP image.');
      return;
    }

    const url = URL.createObjectURL(file);
    const dimensions = await readImageDimensions(url).catch(() => null);
    if (!dimensions) {
      URL.revokeObjectURL(url);
      setError('This image could not be opened.');
      return;
    }

    setImage((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }
      return {
        file,
        url,
        width: dimensions.width,
        height: dimensions.height,
      };
    });
  }

  if (image) {
    return (
      <Suspense
        fallback={
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Loading editor...
          </div>
        }
      >
        <CanvasMaskEditor
          key={image.url}
          image={image}
          onReplaceImage={() => setImage(null)}
        />
      </Suspense>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="rounded-lg border border-dashed border-teal-300 bg-teal-50/70 p-6 text-center sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-lg bg-white text-teal-700 shadow-sm">
          <Upload className="size-7" />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-slate-950">
          Upload a photo to start
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
          Drop in a photo, brush over the unwanted area, and let AI Remover
          clean it up.
        </p>
        <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800">
          <ImageIcon className="size-4" />
          Choose image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </label>
        {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
        <p className="mt-4 text-xs text-slate-500">
          JPG, PNG, or WebP. Free to try, no sign-up for low-res download.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-slate-600">
        {['Upload', 'Brush', 'Remove', 'Download'].map((step, index) => (
          <div key={step} className="rounded-lg bg-slate-50 p-2">
            <span className="block font-medium text-slate-950">
              {index + 1}. {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function readImageDimensions(
  url: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = reject;
    image.src = url;
  });
}
