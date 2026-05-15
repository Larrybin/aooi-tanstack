'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

type RemoverDownloadVariant = 'low-res' | 'high-res';

export function RemoverDownloadButton({
  jobId,
  variant,
  label,
}: {
  jobId: string;
  variant: RemoverDownloadVariant;
  label: string;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    setIsDownloading(true);
    setError('');

    try {
      const response = await fetch(`/api/remover/download/${variant}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(data?.message || `Download failed with ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        variant === 'high-res'
          ? 'ai-remover-high-res.png'
          : 'ai-remover-low-res.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError: unknown) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Download failed'
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={isDownloading}
        onClick={() => {
          void download();
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="size-4" />
        {isDownloading ? 'Downloading...' : label}
      </button>
      {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
