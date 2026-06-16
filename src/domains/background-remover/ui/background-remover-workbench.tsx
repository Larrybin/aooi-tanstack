'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Download,
  ImagePlus,
  Loader2,
  Upload,
} from 'lucide-react';

import type { BackgroundRemoverWorkbenchCopy } from './background-remover-home-copy';

type RemoveResponse = {
  id: string;
  previewUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
  expiresAt: string;
};

type WorkbenchStatus =
  | 'idle'
  | 'ready'
  | 'validating'
  | 'processing'
  | 'succeeded'
  | 'failed';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CLIENT_MAX_BYTES = 20 * 1024 * 1024;

function isApiEnvelope(value: unknown): value is {
  code: number;
  message?: string;
  data?: RemoveResponse;
} {
  return value !== null && typeof value === 'object' && 'code' in value;
}

function checkerboardClassName() {
  return [
    'bg-[linear-gradient(45deg,#E6EBF2_25%,transparent_25%),linear-gradient(-45deg,#E6EBF2_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#E6EBF2_75%),linear-gradient(-45deg,transparent_75%,#E6EBF2_75%)]',
    'bg-[length:22px_22px]',
    'bg-[position:0_0,0_11px,11px_-11px,-11px_0]',
  ].join(' ');
}

async function readImageDimensions(
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

export function BackgroundRemoverWorkbench({
  copy,
}: {
  copy: BackgroundRemoverWorkbenchCopy;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<WorkbenchStatus>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [result, setResult] = useState<RemoveResponse | null>(null);
  const [error, setError] = useState('');

  const busy = status === 'validating' || status === 'processing';
  const selectedFileLabel = useMemo(() => {
    if (!file) return copy.selectedFileEmpty;
    const mb = file.size / (1024 * 1024);
    return `${file.name} · ${mb.toFixed(mb >= 10 ? 0 : 1)}MB`;
  }, [copy.selectedFileEmpty, file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function chooseFile(nextFile: File | undefined) {
    setError('');
    setResult(null);
    if (!nextFile) return;

    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      setStatus('failed');
      setError(copy.invalidTypeError);
      return;
    }
    if (nextFile.size > CLIENT_MAX_BYTES) {
      setStatus('failed');
      setError(copy.fileTooLargeError);
      return;
    }

    setStatus('validating');
    const objectUrl = URL.createObjectURL(nextFile);
    const nextDimensions = await readImageDimensions(objectUrl).catch(
      () => null
    );
    if (!nextDimensions) {
      URL.revokeObjectURL(objectUrl);
      setStatus('failed');
      setError(copy.openError);
      return;
    }

    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return objectUrl;
    });
    setFile(nextFile);
    setDimensions(nextDimensions);
    setStatus('ready');
  }

  async function removeBackground() {
    if (!file || !dimensions || busy) return;

    setStatus('processing');
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.set('image', file);
    formData.set('width', String(dimensions.width));
    formData.set('height', String(dimensions.height));

    try {
      const response = await fetch('/api/background-remover/remove', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      });
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!isApiEnvelope(payload) || !response.ok || payload.code !== 0) {
        throw new Error(
          isApiEnvelope(payload) && payload.message
            ? payload.message
            : `Request failed with ${response.status}`
        );
      }

      setResult(payload.data ?? null);
      setStatus('succeeded');
    } catch (err: unknown) {
      setStatus('failed');
      setError(err instanceof Error ? err.message : copy.defaultProcessError);
    }
  }

  function reset() {
    setFile(null);
    setDimensions(null);
    setResult(null);
    setError('');
    setStatus('idle');
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
  }

  return (
    <div className="mt-8 rounded-lg border border-[#D8E1F2] bg-white p-3 shadow-sm sm:p-4 lg:p-5">
      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div
          className={[
            'flex min-h-[420px] flex-col justify-between rounded-lg border border-dashed p-5 transition',
            isDragging
              ? 'border-[#4F6EF7] bg-[#E6EEFF]'
              : 'border-[#D8E1F2] bg-[#F4F7FB]',
          ].join(' ')}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void chooseFile(event.dataTransfer.files?.[0]);
          }}
        >
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex size-12 items-center justify-center rounded-lg bg-white text-[#4F6EF7] shadow-sm">
                <Upload className="size-6" />
              </div>
              <span className="rounded-md bg-white px-3 py-1 text-xs font-medium text-[#334155]">
                {copy.sizeBadge}
              </span>
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-[#0F172A]">
              {copy.uploadTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#334155]">
              {copy.uploadDescription}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#0F172A] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#334155] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ImagePlus className="size-4" />
              {copy.chooseImage}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                void chooseFile(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </div>

          <div className="mt-8 rounded-md border border-[#E6EBF2] bg-white p-3 text-sm text-[#334155]">
            <p className="font-medium text-[#0F172A]">{selectedFileLabel}</p>
            {dimensions ? (
              <p className="mt-1 text-xs">
                {dimensions.width} x {dimensions.height}px
              </p>
            ) : (
              <p className="mt-1 text-xs">{copy.fileHint}</p>
            )}
          </div>
        </div>

        <div className="flex min-h-[420px] flex-col rounded-lg border border-[#E6EBF2] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#E6EBF2] px-4 py-3">
            <div>
              <h2 className="font-semibold text-[#0F172A]">
                {copy.resultTitle}
              </h2>
              <p className="text-xs text-[#64748B]">{copy.resultDescription}</p>
            </div>
            <span
              aria-live="polite"
              className="rounded-md bg-[#F4F7FB] px-3 py-1 text-xs font-medium text-[#334155]"
            >
              {status === 'processing'
                ? copy.statuses.processing
                : status === 'succeeded'
                  ? copy.statuses.succeeded
                  : status === 'ready'
                    ? copy.statuses.ready
                    : copy.statuses.waiting}
            </span>
          </div>

          <div
            className={[
              'relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-b-lg p-4',
              checkerboardClassName(),
            ].join(' ')}
          >
            {previewUrl ? (
              <div className="grid w-full gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-white/80 bg-white/85 p-2 shadow-sm backdrop-blur">
                  <p className="mb-2 text-xs font-medium text-[#334155]">
                    {copy.before}
                  </p>
                  <img
                    src={previewUrl}
                    alt={copy.originalAlt}
                    className="max-h-[360px] w-full rounded-md object-contain"
                  />
                </div>
                <div className="rounded-lg border border-white/80 bg-white/75 p-2 shadow-sm backdrop-blur">
                  <p className="mb-2 text-xs font-medium text-[#334155]">
                    {copy.transparentPng}
                  </p>
                  {result ? (
                    <img
                      src={result.previewUrl}
                      alt={copy.resultAlt}
                      className="max-h-[360px] w-full rounded-md object-contain"
                    />
                  ) : (
                    <div className="flex min-h-[240px] items-center justify-center rounded-md border border-dashed border-[#D8E1F2] bg-white/40 p-6 text-center text-sm text-[#64748B]">
                      {status === 'processing' ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="size-4 animate-spin" />
                          {copy.removing}
                        </span>
                      ) : (
                        copy.runRemovalHint
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-sm text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-lg bg-white text-[#4F6EF7] shadow-sm">
                  <ImagePlus className="size-7" />
                </div>
                <p className="mt-4 font-medium text-[#0F172A]">
                  {copy.emptyPreviewTitle}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#334155]">
                  {copy.emptyPreviewDescription}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#F2C7C9] bg-[#FFF3F3] p-4 text-sm text-[#8F1D22]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={reset}
          disabled={busy || (!file && !result)}
          className="inline-flex min-h-11 items-center rounded-md border border-[#D8E1F2] bg-white px-4 py-2.5 text-sm font-medium text-[#334155] transition hover:bg-[#F4F7FB] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copy.tryAnotherImage}
        </button>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void removeBackground()}
            disabled={!file || busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#4F6EF7] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#3F5BE0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {copy.removeBackground}
          </button>
          <a
            href={result?.downloadUrl || '#'}
            download="transparent-background.png"
            aria-disabled={!result}
            className={[
              'inline-flex min-h-11 items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition',
              result
                ? 'bg-[#0F172A] text-white hover:bg-[#334155]'
                : 'pointer-events-none bg-[#E6EBF2] text-[#94A3B8]',
            ].join(' ')}
          >
            <Download className="size-4" />
            {copy.downloadPng}
          </a>
        </div>
      </div>

      {result ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D8E1F2] bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-md gap-2">
            <button
              type="button"
              onClick={reset}
              className="min-h-11 flex-1 rounded-md border border-[#D8E1F2] px-3 text-sm font-medium text-[#334155]"
            >
              {copy.tryAnother}
            </button>
            <a
              href={result.downloadUrl}
              download="transparent-background.png"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#0F172A] px-3 text-sm font-medium text-white"
            >
              <Download className="size-4" />
              {copy.downloadPng}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
