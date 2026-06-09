'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FileVideo,
  Gauge,
  HardDrive,
  Info,
  Loader2,
  Monitor,
  Music2,
  Play,
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

export function buildCompressionArgs({
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
  const args = ['-i', 'input.mp4', '-map', '0:v:0'];
  if (audio !== 'remove') {
    args.push('-map', '0:a?');
  }
  args.push(...buildScaleArgs({ resolution, video }));

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
  } else if (audio === 'keep') {
    args.push('-c:a', 'copy');
  } else {
    args.push('-c:a', 'aac', '-b:a', '96k');
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

function FileSummaryRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 border-t border-[#D9E1EC] px-4 py-3 text-sm first:border-t-0">
      <span className="text-[#64748B]">{icon}</span>
      <span className="text-[#475569]">{label}</span>
      <span className="font-medium text-[#334155]">{value}</span>
    </div>
  );
}

function SmallVideoThumb({
  video,
  label,
}: {
  video: VideoInfo | null;
  label: string;
}) {
  return (
    <div className="relative flex aspect-video w-28 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#CBD5E1] text-white">
      {video ? (
        <video
          src={video.url}
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full bg-[linear-gradient(135deg,#CBD5E1,#94A3B8)]" />
      )}
      <span className="absolute inset-0 bg-black/15" />
      <Play className="relative z-10 size-5 fill-current" />
      <span className="absolute right-1.5 bottom-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] leading-none text-white">
        {label}
      </span>
    </div>
  );
}

function PreviewStrip({
  video,
  result,
  estimatedBytes,
}: {
  video: VideoInfo | null;
  result: CompressionResult | null;
  estimatedBytes: number;
}) {
  const compressedSize = result?.sizeBytes ?? estimatedBytes;
  return (
    <div className="grid gap-4 border-t border-[#D9E1EC] bg-[#F8FAFC] p-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
      <div className="min-w-0">
        <p className="mb-2 text-sm font-semibold text-[#111827]">Original</p>
        <div className="flex items-center gap-3">
          <SmallVideoThumb
            video={video}
            label={formatDuration(video?.duration ?? 117)}
          />
          <div className="min-w-0 text-sm text-[#475569]">
            <p className="truncate font-medium text-[#111827]">
              {video?.name ?? 'launch-demo.mp4'}
            </p>
            <p>
              {video ? `${video.width} x ${video.height}` : '4K (3840 x 2160)'}
            </p>
            <p>
              {formatDuration(video?.duration ?? 222)} ·{' '}
              {formatBytes(video?.sizeBytes ?? 248 * MB)}
            </p>
          </div>
        </div>
      </div>
      <ArrowRight className="mx-auto hidden size-7 text-[#64748B] md:block" />
      <div className="min-w-0">
        <p className="mb-2 text-sm font-semibold text-[#111827]">
          Compressed preview
        </p>
        <div className="flex items-center gap-3">
          <SmallVideoThumb
            video={video && result ? { ...video, url: result.url } : video}
            label={formatDuration(video?.duration ?? 117)}
          />
          <div className="min-w-0 text-sm text-[#475569]">
            <p className="truncate font-medium text-[#111827]">
              {video?.name
                ? `${video.name.replace(/\.mp4$/i, '')} (compressed).mp4`
                : 'launch-demo (compressed).mp4'}
            </p>
            <p>1080p (1920 x 1080)</p>
            <p>
              {formatDuration(video?.duration ?? 222)} · ~
              {formatBytes(compressedSize)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultComparison({
  video,
  result,
  estimatedBytes,
  savedPercent,
  copy,
}: {
  video: VideoInfo | null;
  result: CompressionResult | null;
  estimatedBytes: number;
  savedPercent: number;
  copy: Mp4CompressorWorkbenchCopy;
}) {
  const originalSize = video?.sizeBytes ?? 9.7 * MB;
  const compressedSize = result?.sizeBytes ?? estimatedBytes;
  const displaySavedPercent =
    result && video
      ? savedPercent
      : calculateSavedPercent(originalSize, compressedSize);

  return (
    <section className="mt-5 rounded-lg border border-[#D7E0ED] bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold tracking-normal text-[#10182B]">
          Compare before and after
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6FAF1] px-3 py-1 text-xs font-semibold text-[#08744B]">
          <CheckCircle2 className="size-3.5" />
          {result ? copy.statusComplete : 'Preview estimate'}
        </span>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {video ? (
          <UploadedVideoPreview
            title={copy.original}
            video={video}
            sizeBytes={originalSize}
          />
        ) : (
          <DemoVideoPreview
            title={copy.original}
            size={formatBytes(originalSize)}
          />
        )}
        {video ? (
          <UploadedVideoPreview
            title={copy.compressed}
            video={{ ...video, url: result?.url ?? video.url }}
            sizeBytes={compressedSize}
            badge={
              displaySavedPercent > 0
                ? `${displaySavedPercent}% smaller`
                : 'MP4 preview'
            }
          />
        ) : (
          <DemoVideoPreview
            title={copy.compressed}
            size={formatBytes(compressedSize)}
            badge={
              displaySavedPercent > 0
                ? `${displaySavedPercent}% smaller`
                : 'MP4 preview'
            }
          />
        )}
      </div>
    </section>
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
  const fileSelectionIdRef = useRef(0);
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
    return 'Choose an MP4 file to start compressing in your browser.';
  }, [
    copy.compressError,
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

  function clearVideo() {
    setVideo((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function chooseFile(nextFile: File | undefined) {
    if (busy) return;

    const selectionId = fileSelectionIdRef.current + 1;
    fileSelectionIdRef.current = selectionId;
    setError('');
    clearResult();
    if (!nextFile) return;

    if (nextFile.type !== 'video/mp4' && !nextFile.name.endsWith('.mp4')) {
      clearVideo();
      setStatus('failed');
      setError(copy.invalidTypeError);
      return;
    }

    try {
      const nextVideo = await readVideoMetadata(nextFile);
      if (fileSelectionIdRef.current !== selectionId) {
        URL.revokeObjectURL(nextVideo.url);
        return;
      }

      const suggestedTargetMb = Math.floor((nextVideo.sizeBytes * 0.42) / MB);
      setVideo((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return nextVideo;
      });
      setTargetSizeMb(Math.max(0, suggestedTargetMb));
      setStatus('ready');
    } catch {
      if (fileSelectionIdRef.current !== selectionId) {
        return;
      }

      clearVideo();
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

  const displayVideoName = video?.name ?? 'No MP4 selected';
  const displayResolution = video
    ? `${video.width} x ${video.height}`
    : 'Choose a file';
  const displayDuration = video ? formatDuration(video.duration) : '0:00';
  const displayedCompressedBytes = result?.sizeBytes ?? estimatedBytes;

  return (
    <div id="compressor" className="mt-2 scroll-mt-24 pt-4">
      <div className="mb-6">
        <h1 className="max-w-4xl text-4xl font-semibold tracking-normal text-[#10182B] sm:text-5xl">
          Compress MP4 videos with control
        </h1>
        <p className="mt-3 max-w-3xl text-lg leading-8 text-[#475569]">
          Pick a smaller size, preserve visual quality, and keep the file on
          your device.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.84fr_1fr]">
        <div className="rounded-lg border border-[#D7E0ED] bg-white p-4 sm:p-5">
          <div
            className={[
              'grid min-h-52 place-items-center rounded-lg border border-dashed p-6 text-center transition',
              isDragging
                ? 'border-[#0F5AE8] bg-[#EFF6FF]'
                : 'border-[#B7C4D6] bg-[#FBFDFF]',
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
            <div>
              <UploadCloud className="mx-auto size-11 text-[#0F5AE8]" />
              <p className="mt-4 text-lg font-semibold text-[#111827]">
                Select or drop an MP4 file
              </p>
              <p className="mt-2 text-sm text-[#475569]">
                MP4 only. No uploads. All processing happens on your device.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-[#0F5AE8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B48BC] disabled:cursor-not-allowed disabled:bg-[#93A4BD]"
              >
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

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-[#CBD5E1] bg-[#EFF6FF] text-[#0F5AE8]">
                <FileVideo className="size-9" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-[#111827]">
                  {displayVideoName}
                </p>
                <p className="mt-1 text-base text-[#64748B]">
                  {formatBytes(sourceBytes)}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-medium text-[#08744B]">
              <CheckCircle2 className="size-5" />
              Local only
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-md border border-[#D9E1EC]">
            <FileSummaryRow
              icon={<Monitor className="size-5" />}
              label="Resolution"
              value={displayResolution}
            />
            <FileSummaryRow
              icon={<Clock3 className="size-5" />}
              label="Duration"
              value={displayDuration}
            />
            <FileSummaryRow
              icon={<FileVideo className="size-5" />}
              label="Video codec"
              value={video ? 'H.264' : '-'}
            />
            <FileSummaryRow
              icon={<Music2 className="size-5" />}
              label="Audio codec"
              value={audio === 'remove' ? 'Removed' : 'AAC'}
            />
            <FileSummaryRow
              icon={<HardDrive className="size-5" />}
              label="File size"
              value={formatBytes(sourceBytes)}
            />
            <FileSummaryRow
              icon={<ShieldCheck className="size-5" />}
              label="Privacy"
              value="Local only"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#D7E0ED] bg-white">
          <div className="border-b border-[#D9E1EC] px-5 py-4">
            <h2 className="text-xl font-semibold tracking-normal text-[#111827]">
              Compression settings
            </h2>
          </div>
          <div className="space-y-5 p-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                Compression mode
                <Info className="size-4 text-[#64748B]" />
              </div>
              <div className="grid overflow-hidden rounded-md border border-[#CBD5E1] sm:grid-cols-3">
                {[
                  { value: 'best', label: copy.bestQuality },
                  { value: 'balanced', label: copy.balanced },
                  { value: 'smallest', label: copy.smallestFile },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      clearResult();
                      setMode(item.value as CompressionMode);
                    }}
                    className={[
                      'min-h-10 px-4 text-sm font-medium transition',
                      mode === item.value
                        ? 'bg-[#0F5AE8] text-white'
                        : 'bg-white text-[#475569] hover:bg-[#F8FAFC]',
                    ].join(' ')}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-[#64748B]">
                {mode === 'best'
                  ? copy.bestQualityHint
                  : mode === 'balanced'
                    ? 'Balanced gives you a good mix of quality and file size.'
                    : copy.smallestFileHint}
              </p>
            </div>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                Approx target size (MB)
                <Info className="size-4 text-[#64748B]" />
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  value={targetSizeMb}
                  onChange={(event) => {
                    clearResult();
                    setTargetSizeMb(Math.max(0, Number(event.target.value)));
                  }}
                  className="h-11 flex-1 rounded-md border border-[#CBD5E1] bg-white px-3 text-sm font-medium text-[#111827]"
                />
                <span className="rounded-md bg-[#F1F5F9] px-3 py-2 text-sm font-semibold text-[#475569]">
                  MB
                </span>
                <span className="text-sm text-[#64748B]">approximate</span>
              </div>
              <span className="mt-2 block text-sm text-[#64748B]">
                Enter the desired file size. Actual size may vary.
              </span>
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                {copy.resolution}
                <Info className="size-4 text-[#64748B]" />
              </span>
              <select
                value={resolution}
                onChange={(event) => {
                  clearResult();
                  setResolution(event.target.value as ResolutionOption);
                }}
                className="h-11 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm font-medium text-[#111827]"
              >
                <option value="original">Original</option>
                <option value="1080p">1080p (1920 x 1080)</option>
                <option value="720p">720p (1280 x 720)</option>
                <option value="480p">480p (854 x 480)</option>
              </select>
              <span className="mt-2 block text-sm text-[#64748B]">
                Lower resolution reduces file size and may affect sharpness.
              </span>
            </label>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                {copy.audio}
                <Info className="size-4 text-[#64748B]" />
              </div>
              <div className="grid overflow-hidden rounded-md border border-[#CBD5E1] sm:grid-cols-3">
                {[
                  { value: 'keep', label: copy.keep },
                  { value: 'reduce', label: copy.reduce },
                  { value: 'remove', label: copy.remove },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      clearResult();
                      setAudio(item.value as AudioOption);
                    }}
                    className={[
                      'min-h-10 px-4 text-sm font-medium transition',
                      audio === item.value
                        ? 'bg-[#0F5AE8] text-white'
                        : 'bg-white text-[#475569] hover:bg-[#F8FAFC]',
                    ].join(' ')}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-[#64748B]">
                Keep original audio quality and track(s).
              </p>
            </div>

            <div className="rounded-md border border-[#BFD7FF] bg-[#EFF6FF] px-4 py-3 text-sm font-medium text-[#0F5AE8]">
              {copy.estimatedOutput}: ~{formatBytes(displayedCompressedBytes)}.{' '}
              {copy.actualMayVary}
            </div>

            {result?.url ? (
              <a
                href={result.url}
                download={`compressed-${video?.name ?? 'video.mp4'}`}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0F5AE8] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#0B48BC]"
              >
                <Download className="size-5" />
                {copy.downloadMp4}
              </a>
            ) : (
              <button
                type="button"
                disabled={!video || busy}
                onClick={() => {
                  void compress();
                }}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0F5AE8] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#0B48BC] disabled:cursor-not-allowed disabled:bg-[#93A4BD]"
              >
                {busy ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Gauge className="size-5" />
                )}
                {busy ? statusTitle : copy.startCompress}
              </button>
            )}

            {busy ? (
              <div>
                <div className="h-2 overflow-hidden rounded-full bg-[#E8EEF6]">
                  <div
                    className="h-full rounded-full bg-[#0F5AE8] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={cancel}
                  className="mt-3 text-sm font-semibold text-[#334155] underline underline-offset-4"
                >
                  {copy.cancel}
                </button>
              </div>
            ) : null}

            <div className="flex items-center gap-2 text-sm text-[#64748B]">
              {status === 'failed' ? (
                <AlertTriangle className="size-4 text-[#C2410C]" />
              ) : (
                <Clock3 className="size-4" />
              )}
              <span>{riskyFile ? copy.riskHint : statusMessage}</span>
            </div>
          </div>
          <PreviewStrip
            video={video}
            result={result}
            estimatedBytes={estimatedBytes}
          />
        </div>
      </div>

      <ResultComparison
        video={video}
        result={result}
        estimatedBytes={estimatedBytes}
        savedPercent={savedPercent}
        copy={copy}
      />

      <div className="mt-6 flex justify-center">
        <p className="inline-flex items-center gap-2 rounded-md bg-[#E6FAF1] px-4 py-2 text-sm font-semibold text-[#08744B]">
          <ShieldCheck className="size-4" />
          {copy.privacyNote}
        </p>
      </div>
    </div>
  );
}
