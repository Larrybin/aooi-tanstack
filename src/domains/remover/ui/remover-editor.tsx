'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import { ImageIcon, Upload } from 'lucide-react';

import type { UploadedRemoverImage } from './remover-editor-types';
import type { RemoverEditorCopy } from './remover-home-copy';

const CanvasMaskEditor = lazy(() => import('./remover-canvas-editor'));

export function RemoverEditorEntry({
  copy,
  locale,
  signInCallbackPath,
}: {
  copy: RemoverEditorCopy;
  locale: string;
  signInCallbackPath: string;
}) {
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
      setError(copy.invalidTypeError);
      return;
    }

    const url = URL.createObjectURL(file);
    const dimensions = await readImageDimensions(url).catch(() => null);
    if (!dimensions) {
      URL.revokeObjectURL(url);
      setError(copy.openError);
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
            {copy.loading}
          </div>
        }
      >
        <CanvasMaskEditor
          key={image.url}
          image={image}
          copy={copy.canvas}
          locale={locale}
          signInCallbackPath={signInCallbackPath}
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
          {copy.uploadTitle}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
          {copy.uploadDescription}
        </p>
        <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800">
          <ImageIcon className="size-4" />
          {copy.chooseImage}
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
        <p className="mt-4 text-xs text-slate-500">{copy.fileHint}</p>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-slate-600">
        {copy.steps.map((step, index) => (
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
