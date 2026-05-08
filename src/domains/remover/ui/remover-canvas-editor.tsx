'use client';

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Brush,
  Eraser,
  Move,
  RotateCcw,
  Undo2,
  Upload,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import type { UploadedRemoverImage } from './remover-editor-types';
import { buildBinaryMaskPixels } from './remover-mask';
import {
  uploadRemoverAssetsForJob,
  type RemoverUploadResponse,
} from './remover-upload-flow';

type EditorTool = 'brush' | 'eraser' | 'pan';
type JobState =
  | 'idle'
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'succeeded'
  | 'failed';

type RemoverJobResponse = {
  job: {
    id: string;
    status: JobState;
    highResDownloadRequiresSignIn?: boolean;
    errorMessage?: string | null;
  };
};

export default function CanvasMaskEditor({
  image,
  onReplaceImage,
}: {
  image: UploadedRemoverImage;
  onReplaceImage: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const panStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    x: number;
    y: number;
  } | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const [tool, setTool] = useState<EditorTool>('brush');
  const [brushSize, setBrushSize] = useState(36);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hasMask, setHasMask] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [jobState, setJobState] = useState<JobState>('idle');
  const [jobId, setJobId] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [jobError, setJobError] = useState('');
  const [highResRequiresSignIn, setHighResRequiresSignIn] = useState(false);

  function resetMask() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [];
    setHistoryCount(0);
    setHasMask(false);
    setJobState('idle');
    setJobId('');
    setResultUrl('');
    setJobError('');
    setHighResRequiresSignIn(false);
  }

  function pushHistory() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    historyRef.current.push(
      context.getImageData(0, 0, canvas.width, canvas.height)
    );
    if (historyRef.current.length > 20) {
      historyRef.current.shift();
    }
    setHistoryCount(historyRef.current.length);
  }

  function undo() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const previous = historyRef.current.pop();
    if (!canvas || !context || !previous) {
      return;
    }

    context.putImageData(previous, 0, 0);
    setHistoryCount(historyRef.current.length);
    setHasMask(!isCanvasEmpty(canvas));
    setJobState('idle');
    setJobId('');
    setResultUrl('');
    setJobError('');
    setHighResRequiresSignIn(false);
  }

  function getPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  function drawTo(point: { x: number; y: number }) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const lastPoint = lastPointRef.current;
    if (!canvas || !context || !lastPoint) {
      return;
    }

    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = brushSize;

    if (tool === 'eraser') {
      context.globalCompositeOperation = 'destination-out';
      context.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = 'rgba(20,184,166,0.48)';
    }

    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    context.restore();

    lastPointRef.current = point;
    setHasMask(!isCanvasEmpty(canvas));
    setJobState('idle');
    setJobId('');
    setResultUrl('');
    setJobError('');
    setHighResRequiresSignIn(false);
  }

  async function removeMarkedArea() {
    const canvas = canvasRef.current;
    if (!canvas || !hasMask || isBusy(jobState)) {
      return;
    }

    setJobState('uploading');
    setResultUrl('');
    setJobError('');

    try {
      const maskBlob = await canvasToPngBlob(createBinaryMaskCanvas(canvas));
      const { inputUpload, maskUpload } = await uploadRemoverAssetsForJob({
        image,
        maskBlob,
        uploadAsset: uploadRemoverAsset,
      });

      const job = await createRemoverJob({
        inputImageAssetId: inputUpload.asset.id,
        maskImageAssetId: maskUpload.asset.id,
      });
      setJobId(job.job.id);
      setJobState(job.job.status);

      const finalJob =
        job.job.status === 'succeeded' || job.job.status === 'failed'
          ? job
          : await pollRemoverJob(job.job.id, setJobState);
      setJobId(finalJob.job.id);

      if (finalJob.job.status === 'succeeded') {
        setResultUrl(await createDownloadObjectUrl(finalJob.job.id, 'low-res'));
        setHighResRequiresSignIn(
          Boolean(finalJob.job.highResDownloadRequiresSignIn)
        );
        setJobState('succeeded');
        return;
      }

      setJobState('failed');
      setJobError(
        finalJob.job.errorMessage ||
          'The image could not be processed. Please try another mask.'
      );
    } catch (error: unknown) {
      setJobState('failed');
      setJobError(
        error instanceof Error
          ? error.message
          : 'The image could not be processed.'
      );
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (isBusy(jobState)) {
      return;
    }

    if (tool === 'pan') {
      panStartRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        x: pan.x,
        y: pan.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    pushHistory();
    drawingRef.current = true;
    lastPointRef.current = getPoint(event);
    drawTo(lastPointRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (tool === 'pan' && panStartRef.current) {
      setPan({
        x: panStartRef.current.x + event.clientX - panStartRef.current.pointerX,
        y: panStartRef.current.y + event.clientY - panStartRef.current.pointerY,
      });
      return;
    }

    if (!drawingRef.current) {
      return;
    }

    drawTo(getPoint(event));
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastPointRef.current = null;
    panStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton
            active={tool === 'brush'}
            label="Brush"
            onClick={() => setTool('brush')}
          >
            <Brush className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            active={tool === 'eraser'}
            label="Eraser"
            onClick={() => setTool('eraser')}
          >
            <Eraser className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            active={tool === 'pan'}
            label="Pan"
            onClick={() => setTool('pan')}
          >
            <Move className="size-4" />
          </ToolbarButton>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
            Size
            <input
              type="range"
              min="12"
              max="80"
              value={brushSize}
              disabled={isBusy(jobState)}
              onChange={(event) => setBrushSize(Number(event.target.value))}
              className="w-20 accent-teal-700"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton
            label="Undo"
            onClick={undo}
            disabled={!historyCount || isBusy(jobState)}
          >
            <Undo2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Reset"
            onClick={resetMask}
            disabled={!hasMask || isBusy(jobState)}
          >
            <RotateCcw className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}
          >
            <ZoomOut className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Zoom in"
            onClick={() => setZoom((value) => Math.min(2.2, value + 0.1))}
          >
            <ZoomIn className="size-4" />
          </ToolbarButton>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        <div className="relative h-[420px] touch-none overflow-hidden sm:h-[480px]">
          <div
            className="absolute top-1/2 left-1/2 origin-center"
            style={{
              width: 'min(100%, 720px)',
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
            }}
          >
            <div
              role="img"
              aria-label="Uploaded photo preview"
              className="relative w-full rounded-lg bg-contain bg-center bg-no-repeat"
              style={{
                aspectRatio: `${image.width} / ${image.height}`,
                backgroundImage: `url("${image.url}")`,
              }}
            >
              <canvas
                ref={canvasRef}
                width={image.width}
                height={image.height}
                className="absolute inset-0 h-full w-full rounded-lg"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onReplaceImage}
          disabled={isBusy(jobState)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="size-4" />
          Replace image
        </button>
        <button
          type="button"
          disabled={!hasMask || isBusy(jobState)}
          onClick={() => {
            void removeMarkedArea();
          }}
          className={[
            'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition',
            hasMask && !isBusy(jobState)
              ? 'bg-teal-700 hover:bg-teal-800'
              : 'cursor-not-allowed bg-slate-300',
          ].join(' ')}
          title={
            hasMask
              ? 'Remove the marked area'
              : 'Brush over an area before removing'
          }
        >
          <Wand2
            className={['size-4', isBusy(jobState) ? 'animate-pulse' : ''].join(
              ' '
            )}
          />
          {jobState === 'uploading'
            ? 'Uploading...'
            : jobState === 'queued' || jobState === 'processing'
              ? 'Removing...'
              : 'Remove'}
        </button>
      </div>

      {jobState === 'succeeded' ? (
        <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-900">
          <p className="font-medium">Your cleaned image is ready.</p>
          {resultUrl ? (
            <>
              <div className="mt-3 overflow-hidden rounded-lg border border-teal-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultUrl}
                  alt="AI Remover result"
                  className="max-h-[420px] w-full object-contain"
                />
              </div>
              <a
                href={resultUrl}
                download="ai-remover-result.png"
                className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-sm font-medium text-teal-800 shadow-sm ring-1 ring-teal-200 hover:bg-teal-50"
              >
                Download low-res result
              </a>
              {jobId && highResRequiresSignIn ? (
                <Link
                  href="/sign-in?callbackUrl=/my-images"
                  className="mt-3 ml-2 inline-flex rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
                >
                  Sign in for high-res
                </Link>
              ) : null}
              {jobId && !highResRequiresSignIn ? (
                <button
                  type="button"
                  onClick={() => {
                    void downloadRemoverResult(jobId, 'high-res');
                  }}
                  className="mt-3 ml-2 inline-flex rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
                >
                  Download high-res
                </button>
              ) : null}
            </>
          ) : (
            <div className="mt-3 rounded-lg border border-teal-200 bg-white p-3">
              <p>Sign in to download the high-res result.</p>
              <Link
                href="/sign-in?callbackUrl=/my-images"
                className="mt-3 inline-flex rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
              >
                Sign in to download
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {jobState === 'failed' && jobError ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
          <p className="font-medium">Removal failed</p>
          <p className="mt-1">{jobError}</p>
        </div>
      ) : null}
    </div>
  );
}

function ToolbarButton({
  active = false,
  disabled = false,
  label,
  children,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex size-10 items-center justify-center rounded-lg border text-sm transition',
        active
          ? 'border-teal-700 bg-teal-700 text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        disabled ? 'cursor-not-allowed opacity-40 hover:bg-white' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function isCanvasEmpty(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) {
    return true;
  }

  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] !== 0) {
      return false;
    }
  }
  return true;
}

function isBusy(state: JobState): boolean {
  return state === 'uploading' || state === 'queued' || state === 'processing';
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('Could not export the mask.'));
    }, 'image/png');
  });
}

function createBinaryMaskCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not read the mask.');
  }

  const source = context.getImageData(0, 0, canvas.width, canvas.height);
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;

  const maskContext = maskCanvas.getContext('2d');
  if (!maskContext) {
    throw new Error('Could not create the mask.');
  }

  const mask = maskContext.createImageData(canvas.width, canvas.height);
  mask.data.set(buildBinaryMaskPixels(source.data));
  maskContext.putImageData(mask, 0, 0);

  return maskCanvas;
}

async function uploadRemoverAsset({
  file,
  kind,
  width,
  height,
}: {
  file: File;
  kind: 'original' | 'mask';
  width: number;
  height: number;
}): Promise<RemoverUploadResponse> {
  const formData = new FormData();
  formData.set('image', file);
  formData.set('kind', kind);
  formData.set('width', String(width));
  formData.set('height', String(height));

  return fetchRemoverJson<RemoverUploadResponse>('/api/remover/upload', {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
  });
}

async function createRemoverJob({
  inputImageAssetId,
  maskImageAssetId,
}: {
  inputImageAssetId: string;
  maskImageAssetId: string;
}): Promise<RemoverJobResponse> {
  return fetchRemoverJson<RemoverJobResponse>('/api/remover/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputImageAssetId,
      maskImageAssetId,
      idempotencyKey: crypto.randomUUID(),
    }),
  });
}

async function pollRemoverJob(
  jobId: string,
  setJobState: (state: JobState) => void
): Promise<RemoverJobResponse> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await delay(2000);
    const result = await fetchRemoverJson<RemoverJobResponse>(
      `/api/remover/jobs/${encodeURIComponent(jobId)}`,
      { method: 'GET' }
    );
    setJobState(result.job.status);

    if (result.job.status === 'succeeded' || result.job.status === 'failed') {
      return result;
    }
  }

  throw new Error('The removal job timed out. Please try again.');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchRemoverJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as {
    code?: number;
    message?: string;
    data?: T;
  } | null;

  if (!response.ok || data?.code !== 0) {
    throw new Error(data?.message || `Request failed with ${response.status}`);
  }

  return data.data as T;
}

async function createDownloadObjectUrl(
  jobId: string,
  variant: 'low-res' | 'high-res'
): Promise<string> {
  const blob = await fetchRemoverDownloadBlob(jobId, variant);
  return URL.createObjectURL(blob);
}

async function downloadRemoverResult(
  jobId: string,
  variant: 'low-res' | 'high-res'
) {
  const blob = await fetchRemoverDownloadBlob(jobId, variant);
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
}

async function fetchRemoverDownloadBlob(
  jobId: string,
  variant: 'low-res' | 'high-res'
): Promise<Blob> {
  const response = await fetch(`/api/remover/download/${variant}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobId }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(data?.message || `Download failed with ${response.status}`);
  }

  return response.blob();
}
