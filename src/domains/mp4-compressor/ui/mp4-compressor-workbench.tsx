'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileVideo,
  Gauge,
  Loader2,
  LockKeyhole,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  UploadCloud,
  Volume2,
} from 'lucide-react';

import type { Mp4CompressorWorkbenchCopy } from './mp4-compressor-home-copy';

type CompressionMode = 'best' | 'balanced' | 'smallest';
type ResolutionOption = 'original' | '1080p' | '720p' | '480p';
type AudioOption = 'keep' | 'reduce' | 'remove';
type WorkbenchStatus =
  | 'demo'
  | 'ready'
  | 'loading'
  | 'processing'
  | 'succeeded'
  | 'failed';

type VideoInfo = {
  file: File;
  name: string;
  sizeBytes: number;
  width: number;
  height: number;
  duration: number;
  url: string;
};

type CompressionResult = {
  sizeBytes: number;
  url: string;
};

type ProgressEvent = {
  progress: number;
  time: number;
};

type FfmpegInstance = {
  loaded: boolean;
  load: (
    config?: { coreURL?: string; wasmURL?: string },
    options?: { signal?: AbortSignal }
  ) => Promise<boolean>;
  on: (event: 'progress', callback: (event: ProgressEvent) => void) => void;
  off: (event: 'progress', callback: (event: ProgressEvent) => void) => void;
  writeFile: (path: string, data: Uint8Array) => Promise<boolean>;
  exec: (args: string[]) => Promise<number>;
  readFile: (path: string) => Promise<Uint8Array | string>;
  deleteFile: (path: string) => Promise<boolean>;
  terminate: () => void;
};

type FfmpegGlobals = Window & {
  FFmpegWASM?: {
    FFmpeg: new () => FfmpegInstance;
  };
};

type CompressionGlobals = typeof globalThis & {
  DecompressionStream?: typeof DecompressionStream;
};

type CompressionRun = {
  id: number;
  abortController: AbortController;
};

const MODE_SETTINGS: Record<
  CompressionMode,
  { crf: number; labelKey: 'bestQuality' | 'balanced' | 'smallestFile' }
> = {
  best: { crf: 22, labelKey: 'bestQuality' },
  balanced: { crf: 26, labelKey: 'balanced' },
  smallest: { crf: 31, labelKey: 'smallestFile' },
};

const RESOLUTION_HEIGHTS: Record<
  Exclude<ResolutionOption, 'original'>,
  number
> = {
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
};

const DEMO_ORIGINAL_BYTES = 186 * 1024 * 1024;
const DEMO_COMPRESSED_BYTES = 74 * 1024 * 1024;
const MB = 1024 * 1024;

function formatBytes(bytes: number): string {
  const mb = bytes / MB;
  if (mb >= 100) return `${Math.round(mb)} MB`;
  if (mb >= 10) return `${mb.toFixed(1)} MB`;
  return `${Math.max(0.1, mb).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function calculateSavedPercent(originalBytes: number, compressedBytes: number) {
  if (!originalBytes || compressedBytes >= originalBytes) {
    return 0;
  }
  return Math.round(((originalBytes - compressedBytes) / originalBytes) * 100);
}

function estimateOutputBytes({
  sourceBytes,
  mode,
  targetSizeMb,
}: {
  sourceBytes: number;
  mode: CompressionMode;
  targetSizeMb: number;
}) {
  if (targetSizeMb > 0) {
    return Math.min(targetSizeMb * MB, sourceBytes * 0.95);
  }

  const ratio = mode === 'best' ? 0.72 : mode === 'balanced' ? 0.42 : 0.25;
  return Math.max(Math.min(MB, sourceBytes * 0.95), sourceBytes * ratio);
}

function readVideoMetadata(file: File): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve({
        file,
        name: file.name,
        sizeBytes: file.size,
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        url,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('video metadata failed'));
    };
    video.src = url;
  });
}

export function buildScaleArgs({
  resolution,
  video,
}: {
  resolution: ResolutionOption;
  video: Pick<VideoInfo, 'width' | 'height'>;
}) {
  if (resolution === 'original') {
    return [];
  }

  const target = RESOLUTION_HEIGHTS[resolution];
  const isLandscape = video.width >= video.height;
  const scaledDimension = isLandscape ? video.height : video.width;
  if (scaledDimension <= target) {
    return [];
  }

  const scale = isLandscape ? `-2:${target}` : `${target}:-2`;
  return ['-vf', `scale=${scale}`];
}

function buildCompressionArgs({
  mode,
  resolution,
  audio,
  targetSizeMb,
  video,
}: {
  mode: CompressionMode;
  resolution: ResolutionOption;
  audio: AudioOption;
  targetSizeMb: number;
  video: VideoInfo;
}) {
  const args = ['-i', 'input.mp4', ...buildScaleArgs({ resolution, video })];

  if (
    targetSizeMb > 0 &&
    targetSizeMb * MB < video.sizeBytes &&
    video.duration > 0
  ) {
    const audioKbps = audio === 'remove' ? 0 : audio === 'reduce' ? 96 : 128;
    const totalKbps = Math.max(240, (targetSizeMb * 8192) / video.duration);
    const videoKbps = Math.max(160, Math.round(totalKbps - audioKbps));
    args.push('-c:v', 'libx264', '-b:v', `${videoKbps}k`);
    args.push('-maxrate', `${Math.round(videoKbps * 1.35)}k`);
    args.push('-bufsize', `${Math.round(videoKbps * 2)}k`);
  } else {
    args.push('-c:v', 'libx264', '-crf', String(MODE_SETTINGS[mode].crf));
  }

  args.push('-preset', 'veryfast', '-movflags', '+faststart');

  if (audio === 'remove') {
    args.push('-an');
  } else {
    args.push('-c:a', 'aac', '-b:a', audio === 'reduce' ? '96k' : '128k');
  }

  args.push('output.mp4');
  return args;
}

function isLowMemoryDevice() {
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  return typeof memory === 'number' && memory <= 4;
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`
    );
    if (existing?.dataset.loaded === 'true') {
      resolve();
      return;
    }

    const script = existing ?? document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`failed to load ${src}`));
    if (!existing) {
      document.head.appendChild(script);
    }
  });
}

async function loadFfmpegGlobals() {
  await loadScript('/vendor/ffmpeg/ffmpeg.js');

  const globals = window as FfmpegGlobals;
  if (!globals.FFmpegWASM?.FFmpeg) {
    throw new Error('ffmpeg runtime is unavailable');
  }
  return {
    FFmpeg: globals.FFmpegWASM.FFmpeg,
  };
}

function createAbortError() {
  return new Error('Compression cancelled');
}

async function fetchBytes(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`failed to load ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function createBlobUrl(
  url: string,
  mimeType: string,
  signal?: AbortSignal
) {
  return URL.createObjectURL(
    new Blob([await fetchBytes(url, signal)], { type: mimeType })
  );
}

export async function fetchGzipBytes(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`failed to load ${url}`);
  }

  const Compression = globalThis as CompressionGlobals;
  if (!response.body || typeof Compression.DecompressionStream !== 'function') {
    throw new Error('gzip decompression is unavailable in this browser');
  }

  const decompressed = response.body.pipeThrough(
    new Compression.DecompressionStream('gzip')
  );
  return new Uint8Array(await new Response(decompressed).arrayBuffer());
}

async function createGzipBlobUrl(
  url: string,
  mimeType: string,
  signal?: AbortSignal
) {
  return URL.createObjectURL(
    new Blob([await fetchGzipBytes(url, signal)], { type: mimeType })
  );
}

function DemoVideoPreview({
  title,
  size,
  badge,
}: {
  title: string;
  size: string;
  badge?: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#172033]">{title}</h3>
        {badge ? (
          <span className="rounded-md bg-[#DFF8EC] px-3 py-1 text-xs font-semibold text-[#08744B]">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-lg border border-[#CFD9E8] bg-[#182636]">
        <div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_50%_50%,#284258,#152332_58%,#101B27)]">
          <div className="flex size-16 items-center justify-center rounded-full bg-black/35 text-white">
            <Play className="ml-1 size-7 fill-current" />
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-white/10 px-3 py-2 text-xs text-white/85">
          <span>0:00 / 2:14</span>
          <span className="h-1 flex-1 rounded-full bg-white/25">
            <span className="block h-1 w-1/4 rounded-full bg-white" />
          </span>
          <Volume2 className="size-4" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-[#475569]">
        <span>{size}</span>
        <span>02:14</span>
        <span>1080p</span>
      </div>
    </div>
  );
}

function UploadedVideoPreview({
  title,
  video,
  sizeBytes,
  badge,
}: {
  title: string;
  video: VideoInfo;
  sizeBytes: number;
  badge?: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#172033]">{title}</h3>
        {badge ? (
          <span className="rounded-md bg-[#DFF8EC] px-3 py-1 text-xs font-semibold text-[#08744B]">
            {badge}
          </span>
        ) : null}
      </div>
      <video
        src={video.url}
        controls
        className="aspect-video w-full rounded-lg border border-[#CFD9E8] bg-[#182636] object-contain"
      />
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-[#475569]">
        <span>{formatBytes(sizeBytes)}</span>
        <span>{formatDuration(video.duration)}</span>
        <span>
          {video.width} x {video.height}
        </span>
      </div>
    </div>
  );
}

export function Mp4CompressorWorkbench({
  copy,
}: {
  copy: Mp4CompressorWorkbenchCopy;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ffmpegRef = useRef<FfmpegInstance | null>(null);
  const progressCallbackRef = useRef<((event: ProgressEvent) => void) | null>(
    null
  );
  const compressionRunRef = useRef<CompressionRun | null>(null);
  const compressionRunIdRef = useRef(0);
  const videoUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<WorkbenchStatus>('demo');
  const [isDragging, setIsDragging] = useState(false);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [mode, setMode] = useState<CompressionMode>('balanced');
  const [resolution, setResolution] = useState<ResolutionOption>('1080p');
  const [audio, setAudio] = useState<AudioOption>('keep');
  const [targetSizeMb, setTargetSizeMb] = useState(75);
  const [showSettings, setShowSettings] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const sourceBytes = video?.sizeBytes ?? DEMO_ORIGINAL_BYTES;
  const outputBytes = result?.sizeBytes ?? DEMO_COMPRESSED_BYTES;
  const savedPercent = calculateSavedPercent(sourceBytes, outputBytes);
  const estimatedBytes = estimateOutputBytes({
    sourceBytes,
    mode,
    targetSizeMb,
  });
  const riskyFile =
    Boolean(video && video.sizeBytes > 500 * 1024 * 1024) ||
    (typeof navigator !== 'undefined' && isLowMemoryDevice());
  const busy = status === 'loading' || status === 'processing';

  useEffect(() => {
    videoUrlRef.current = video?.url ?? null;
  }, [video?.url]);

  useEffect(() => {
    resultUrlRef.current = result?.url ?? null;
  }, [result?.url]);

  useEffect(() => {
    return () => {
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      ffmpegRef.current?.terminate();
    };
  }, []);

  const statusTitle = useMemo(() => {
    if (status === 'ready') return copy.statusReady;
    if (status === 'loading') return copy.statusLoading;
    if (status === 'processing') return copy.statusProcessing;
    if (status === 'failed') return copy.statusFailed;
    return copy.statusComplete;
  }, [
    copy.statusComplete,
    copy.statusFailed,
    copy.statusLoading,
    copy.statusProcessing,
    copy.statusReady,
    status,
  ]);

  const statusMessage = useMemo(() => {
    if (status === 'ready') return copy.readyMessage;
    if (status === 'loading') return copy.loadingMessage;
    if (status === 'processing') return copy.processingMessage;
    if (status === 'failed') return error || copy.compressError;
    if (status === 'succeeded' && result && video) {
      return savedPercent > 0
        ? `Great! Your video is ${savedPercent}% smaller.`
        : 'Compression complete. Download your MP4 below.';
    }
    return copy.demoSuccess;
  }, [
    copy.compressError,
    copy.demoSuccess,
    copy.loadingMessage,
    copy.processingMessage,
    copy.readyMessage,
    error,
    result,
    savedPercent,
    status,
    video,
  ]);

  function clearResult() {
    setResult((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function chooseFile(nextFile: File | undefined) {
    if (busy) return;

    setError('');
    clearResult();
    if (!nextFile) return;

    if (nextFile.type !== 'video/mp4' && !nextFile.name.endsWith('.mp4')) {
      setStatus('failed');
      setError(copy.invalidTypeError);
      return;
    }

    try {
      const nextVideo = await readVideoMetadata(nextFile);
      const suggestedTargetMb = Math.floor((nextVideo.sizeBytes * 0.42) / MB);
      setVideo((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return nextVideo;
      });
      setTargetSizeMb(Math.max(0, suggestedTargetMb));
      setStatus('ready');
    } catch {
      setStatus('failed');
      setError(copy.openError);
    }
  }

  function isCurrentCompressionRun(runId: number) {
    const run = compressionRunRef.current;
    return run?.id === runId && !run.abortController.signal.aborted;
  }

  async function getFfmpeg(signal: AbortSignal) {
    if (ffmpegRef.current?.loaded) {
      return ffmpegRef.current;
    }

    const { FFmpeg } = await loadFfmpegGlobals();
    if (signal.aborted) {
      throw createAbortError();
    }

    const ffmpeg = new FFmpeg();
    const progressCallback = ({ progress: nextProgress }: ProgressEvent) => {
      if (signal.aborted) {
        return;
      }
      if (Number.isFinite(nextProgress)) {
        setProgress(Math.max(1, Math.min(99, Math.round(nextProgress * 100))));
      }
    };
    progressCallbackRef.current = progressCallback;
    ffmpeg.on('progress', progressCallback);
    ffmpegRef.current = ffmpeg;

    try {
      await ffmpeg.load(
        {
          coreURL: await createBlobUrl(
            '/vendor/ffmpeg/ffmpeg-core.js',
            'text/javascript',
            signal
          ),
          wasmURL: await createGzipBlobUrl(
            '/vendor/ffmpeg/ffmpeg-core.wasm.gz',
            'application/wasm',
            signal
          ),
        },
        { signal }
      );
    } catch (error) {
      ffmpeg.off('progress', progressCallback);
      if (ffmpegRef.current === ffmpeg) {
        ffmpegRef.current = null;
      }
      if (progressCallbackRef.current === progressCallback) {
        progressCallbackRef.current = null;
      }
      ffmpeg.terminate();
      throw error;
    }

    if (signal.aborted) {
      throw createAbortError();
    }

    return ffmpeg;
  }

  async function compress() {
    if (!video || busy) {
      return;
    }

    setStatus('loading');
    setProgress(1);
    setError('');
    clearResult();
    const runId = compressionRunIdRef.current + 1;
    const abortController = new AbortController();
    compressionRunIdRef.current = runId;
    compressionRunRef.current = { id: runId, abortController };

    try {
      const ffmpeg = await getFfmpeg(abortController.signal);
      if (!isCurrentCompressionRun(runId)) {
        return;
      }

      setStatus('processing');
      await ffmpeg.writeFile(
        'input.mp4',
        new Uint8Array(await video.file.arrayBuffer())
      );
      if (!isCurrentCompressionRun(runId)) {
        return;
      }

      const exitCode = await ffmpeg.exec(
        buildCompressionArgs({
          mode,
          resolution,
          audio,
          targetSizeMb,
          video,
        })
      );
      if (!isCurrentCompressionRun(runId)) {
        return;
      }

      if (exitCode !== 0) {
        throw new Error(copy.compressError);
      }

      const data = await ffmpeg.readFile('output.mp4');
      if (!isCurrentCompressionRun(runId)) {
        return;
      }

      if (typeof data === 'string') {
        throw new Error(copy.compressError);
      }

      const outputBuffer = new ArrayBuffer(data.byteLength);
      new Uint8Array(outputBuffer).set(data);
      const blob = new Blob([outputBuffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      setResult({ sizeBytes: blob.size, url });
      setProgress(100);
      setStatus('succeeded');
      await Promise.allSettled([
        ffmpeg.deleteFile('input.mp4'),
        ffmpeg.deleteFile('output.mp4'),
      ]);
    } catch (err: unknown) {
      if (!isCurrentCompressionRun(runId)) {
        return;
      }

      setStatus('failed');
      setError(err instanceof Error ? err.message : copy.compressError);
    } finally {
      if (compressionRunRef.current?.id === runId) {
        compressionRunRef.current = null;
      }
    }
  }

  function cancel() {
    compressionRunRef.current?.abortController.abort();
    compressionRunRef.current = null;
    const ffmpeg = ffmpegRef.current;
    const progressCallback = progressCallbackRef.current;
    if (ffmpeg && progressCallback) {
      ffmpeg.off('progress', progressCallback);
    }
    ffmpeg?.terminate();
    ffmpegRef.current = null;
    progressCallbackRef.current = null;
    setStatus(video ? 'ready' : 'demo');
    setProgress(0);
  }

  function reset() {
    cancel();
    setVideo((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
    clearResult();
    setError('');
    setStatus('demo');
  }

  const showRealVideo = Boolean(video);
  const showResult = status === 'demo' || status === 'succeeded';

  return (
    <div id="compressor" className="mt-8 lg:mt-10">
      <div className="grid gap-7 lg:grid-cols-[0.68fr_1.32fr] lg:items-start">
        <div className="pt-3">
          <h1 className="max-w-md text-5xl font-semibold tracking-normal text-[#10182B] sm:text-6xl">
            Make MP4 files smaller
          </h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-[#334155]">
            Compress videos for sharing, storage, and faster uploads while
            choosing your quality tradeoff.
          </p>

          <div className="mt-8 grid gap-3 text-sm text-[#172033] sm:grid-cols-3 lg:grid-cols-1">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 text-[#08744B]" />
              <span>
                <strong className="block">Local processing</strong>
                <span className="text-[#64748B]">Nothing uploaded</span>
              </span>
            </div>
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 size-5 text-[#0F5AE8]" />
              <span>
                <strong className="block">No watermark</strong>
                <span className="text-[#64748B]">100% free</span>
              </span>
            </div>
            <div className="flex items-start gap-3">
              <FileVideo className="mt-0.5 size-5 text-[#0F5AE8]" />
              <span>
                <strong className="block">MP4 output</strong>
                <span className="text-[#64748B]">H.264 + AAC</span>
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#D7E0ED] bg-white p-5 shadow-[0_18px_60px_rgba(15,31,56,0.08)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                {status === 'failed' ? (
                  <AlertTriangle className="size-5 text-[#C2410C]" />
                ) : busy ? (
                  <Loader2 className="size-5 animate-spin text-[#0F5AE8]" />
                ) : (
                  <CheckCircle2 className="size-5 text-[#08744B]" />
                )}
                <h2 className="font-semibold text-[#0F172A]">{statusTitle}</h2>
              </div>
              <p className="mt-2 text-sm text-[#475569]">{statusMessage}</p>
            </div>
            {busy ? (
              <button
                type="button"
                onClick={cancel}
                className="rounded-md border border-[#CFD9E8] px-4 py-2 text-sm font-semibold text-[#172033] transition hover:bg-[#F6F9FC]"
              >
                {copy.cancel}
              </button>
            ) : null}
          </div>

          {busy ? (
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#E8EEF6]">
              <div
                className="h-full rounded-full bg-[#0F5AE8] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}

          <div className="mt-6 grid rounded-lg border border-[#D7E0ED] text-center sm:grid-cols-3">
            <div className="p-5">
              <p className="text-sm text-[#475569]">{copy.original}</p>
              <p className="mt-2 text-4xl font-semibold text-[#10182B]">
                {formatBytes(sourceBytes)}
              </p>
            </div>
            <div className="border-y border-[#D7E0ED] p-5 sm:border-x sm:border-y-0">
              <p className="text-sm text-[#475569]">{copy.compressed}</p>
              <p className="mt-2 text-4xl font-semibold text-[#08744B]">
                {showResult
                  ? formatBytes(outputBytes)
                  : formatBytes(estimatedBytes)}
              </p>
            </div>
            <div className="p-5">
              <p className="text-sm text-[#475569]">{copy.saved}</p>
              <p className="mt-2 text-4xl font-semibold text-[#08744B]">
                {showResult
                  ? `${savedPercent}%`
                  : `${calculateSavedPercent(sourceBytes, estimatedBytes)}%`}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {result?.url ? (
              <a
                href={result.url}
                download={`compressed-${video?.name ?? 'video.mp4'}`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#0F5AE8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0B48BC]"
              >
                <Download className="size-4" />
                {copy.downloadMp4}
              </a>
            ) : (
              <button
                type="button"
                disabled={!video || busy}
                onClick={() => {
                  void compress();
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#0F5AE8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0B48BC] disabled:cursor-not-allowed disabled:bg-[#93A4BD]"
              >
                <Gauge className="size-4" />
                {copy.startCompress}
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[#9DB1CC] px-5 py-3 text-sm font-semibold text-[#172033] transition hover:bg-[#F6F9FC]"
            >
              <RotateCcw className="size-4" />
              {copy.compressAnother}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-7 rounded-lg border border-[#D7E0ED] bg-white p-5 sm:p-7">
        <div className="grid gap-7 lg:grid-cols-2">
          {showRealVideo && video ? (
            <UploadedVideoPreview
              title={copy.original}
              video={video}
              sizeBytes={video.sizeBytes}
            />
          ) : (
            <DemoVideoPreview title={copy.original} size="186 MB" />
          )}

          {showRealVideo && video && result ? (
            <UploadedVideoPreview
              title={copy.compressed}
              video={{ ...video, url: result.url }}
              sizeBytes={result.sizeBytes}
              badge={
                savedPercent > 0 ? `${savedPercent}% smaller` : 'MP4 ready'
              }
            />
          ) : (
            <DemoVideoPreview
              title={copy.compressed}
              size={showRealVideo ? formatBytes(estimatedBytes) : '74 MB'}
              badge={
                showRealVideo
                  ? `${calculateSavedPercent(sourceBytes, estimatedBytes)}% estimate`
                  : '60% smaller'
              }
            />
          )}
        </div>

        <div className="mt-6 rounded-lg border border-[#C7F0DE] bg-[#F2FBF7] p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-semibold text-[#64748B]">
                {copy.mode}
              </p>
              <p className="mt-1 font-semibold text-[#172033]">
                {copy[MODE_SETTINGS[mode].labelKey]}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#64748B]">
                {copy.resolution}
              </p>
              <p className="mt-1 font-semibold text-[#172033]">
                {resolution === 'original' ? 'Original' : resolution}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#64748B]">
                {copy.audio}
              </p>
              <p className="mt-1 font-semibold text-[#172033]">
                {audio === 'keep'
                  ? copy.keep
                  : audio === 'reduce'
                    ? copy.reduce
                    : copy.remove}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#64748B]">
                {copy.targetSize}
              </p>
              <p className="mt-1 font-semibold text-[#172033]">
                ~{formatBytes(estimatedBytes)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSettings((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[#B9DCCF] bg-white px-4 py-2.5 text-sm font-semibold text-[#172033] transition hover:bg-[#F7FFFB]"
            >
              <Settings2 className="size-4" />
              {copy.editSettings}
            </button>
          </div>

          {showSettings ? (
            <div className="mt-5 grid gap-4 border-t border-[#C7F0DE] pt-5 lg:grid-cols-4">
              <label className="block">
                <span className="text-sm font-semibold text-[#172033]">
                  {copy.mode}
                </span>
                <select
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as CompressionMode)
                  }
                  className="mt-2 h-11 w-full rounded-md border border-[#C8D4E4] bg-white px-3 text-sm"
                >
                  <option value="best">{copy.bestQuality}</option>
                  <option value="balanced">{copy.balanced}</option>
                  <option value="smallest">{copy.smallestFile}</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#172033]">
                  {copy.resolution}
                </span>
                <select
                  value={resolution}
                  onChange={(event) =>
                    setResolution(event.target.value as ResolutionOption)
                  }
                  className="mt-2 h-11 w-full rounded-md border border-[#C8D4E4] bg-white px-3 text-sm"
                >
                  <option value="original">Original</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#172033]">
                  {copy.audio}
                </span>
                <select
                  value={audio}
                  onChange={(event) =>
                    setAudio(event.target.value as AudioOption)
                  }
                  className="mt-2 h-11 w-full rounded-md border border-[#C8D4E4] bg-white px-3 text-sm"
                >
                  <option value="keep">{copy.keep}</option>
                  <option value="reduce">{copy.reduce}</option>
                  <option value="remove">{copy.remove}</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#172033]">
                  {copy.targetSize}
                </span>
                <input
                  type="number"
                  min="0"
                  value={targetSizeMb}
                  onChange={(event) =>
                    setTargetSizeMb(Math.max(0, Number(event.target.value)))
                  }
                  className="mt-2 h-11 w-full rounded-md border border-[#C8D4E4] bg-white px-3 text-sm"
                />
                <span className="mt-1 block text-xs text-[#64748B]">
                  {copy.approximate}
                </span>
              </label>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex justify-center">
          <p className="inline-flex items-center gap-2 rounded-md bg-[#E6FAF1] px-4 py-2 text-sm font-semibold text-[#08744B]">
            <ShieldCheck className="size-4" />
            {copy.privacyNote}
          </p>
        </div>

        {riskyFile ? (
          <div className="mt-5 rounded-md border border-[#FED7AA] bg-[#FFF7ED] p-3 text-sm text-[#9A3412]">
            {copy.riskHint}
          </div>
        ) : null}

        <div
          className={[
            'mt-7 grid gap-5 rounded-lg border border-dashed p-6 transition md:grid-cols-[1fr_auto_1fr] md:items-center',
            isDragging
              ? 'border-[#0F5AE8] bg-[#EFF6FF]'
              : 'border-[#88B6F8] bg-[#F8FBFF]',
          ].join(' ')}
          onDragOver={(event) => {
            event.preventDefault();
            if (busy) return;
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (busy) return;
            void chooseFile(event.dataTransfer.files?.[0]);
          }}
        >
          <div className="text-center">
            <UploadCloud className="mx-auto size-12 text-[#0F5AE8]" />
            <p className="mt-3 text-lg font-semibold text-[#0F5AE8]">
              {copy.chooseFile}{' '}
              <span className="text-sm font-normal text-[#475569]">
                {copy.dropHint}
              </span>
            </p>
            <p className="mt-1 text-sm text-[#475569]">{copy.fileHint}</p>
          </div>
          <div className="hidden h-16 w-px bg-[#D7E0ED] md:block" />
          <div className="text-center">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#0F5AE8] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0B48BC] disabled:cursor-not-allowed disabled:bg-[#93A4BD]"
            >
              <FileVideo className="size-4" />
              {copy.chooseFile}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,.mp4"
              className="sr-only"
              onChange={(event) => {
                void chooseFile(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </div>
        </div>

        <p className="mt-3 text-center text-sm text-[#64748B]">
          {copy.estimatedOutput}: ~{formatBytes(estimatedBytes)}.{' '}
          {copy.actualMayVary}
        </p>
      </div>
    </div>
  );
}
