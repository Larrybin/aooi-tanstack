'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  CheckCircle2,
  Coins,
  Download,
  FileText,
  History,
  LockKeyhole,
  Play,
  ShieldCheck,
  Volume2,
} from 'lucide-react';

import {
  TEXT_TO_SPEECH_LANGUAGES,
  TEXT_TO_SPEECH_PLAYBACK_SPEEDS,
  TEXT_TO_SPEECH_VOICES,
} from '../domain/config';
import {
  mergeTextToSpeechHistory,
  type TextToSpeechHistoryItem,
} from './history-state';
import type { TextToSpeechGeneratorHomeCopy } from './text-to-speech-home-copy';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback': () => void;
          'error-callback': () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

type TextToSpeechQuotaSummary = {
  actorKind: 'user' | 'anonymous';
  productId: string;
  monthlyCharacters: number;
  monthlyUsedCharacters: number;
  monthlyRemainingCharacters: number;
  extraCreditsRemaining: number;
  resetAt: string | null;
  guestDailyPreviews: number;
};

export function TextToSpeechGeneratorWorkbench({
  copy,
  turnstileSiteKey,
}: {
  copy: TextToSpeechGeneratorHomeCopy['generator'];
  turnstileSiteKey: string;
}) {
  const [text, setText] = useState(copy.sampleText);
  const [language, setLanguage] = useState('en');
  const [voice, setVoice] = useState('aura-asteria-en');
  const [playbackSpeed, setPlaybackSpeed] = useState('1x');
  const [audioSrc, setAudioSrc] = useState('');
  const [history, setHistory] = useState<TextToSpeechHistoryItem[]>([]);
  const [quota, setQuota] = useState<TextToSpeechQuotaSummary | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'generating' | 'ready' | 'error'
  >('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetRef = useRef<string | null>(null);
  const voices = useMemo(
    () =>
      TEXT_TO_SPEECH_VOICES.filter(
        (item) => item.language === language || item.language === 'multi'
      ),
    [language]
  );
  const selectedVoice = voices.some((item) => item.id === voice)
    ? voice
    : (voices[0]?.id ?? '');
  const isGenerating = status === 'generating';
  const quotaPercent =
    quota?.actorKind === 'user' && quota.monthlyCharacters > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (quota.monthlyUsedCharacters / quota.monthlyCharacters) * 100
            )
          )
        )
      : null;

  function applySamplePreset(sampleText: string) {
    setText(sampleText);
    setAudioSrc('');
    setStatus('idle');
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = Number(playbackSpeed.replace('x', ''));
    }
  }, [playbackSpeed, audioSrc]);

  useEffect(() => {
    let ignore = false;

    async function loadHistoryState() {
      try {
        const historyResponse = await fetch('/api/tts/history');
        const historyBody = (await historyResponse.json()) as {
          code: number;
          data?: { items?: TextToSpeechHistoryItem[] };
        };
        if (!ignore && historyResponse.ok && historyBody.code === 0) {
          setHistory(historyBody.data?.items ?? []);
        }
      } catch {
        if (!ignore) {
          setHistory([]);
        }
      }
    }

    async function loadQuotaState() {
      try {
        const quotaResponse = await fetch('/api/tts/quota');
        const quotaBody = (await quotaResponse.json()) as {
          code: number;
          data?: TextToSpeechQuotaSummary;
        };
        if (!ignore && quotaResponse.ok && quotaBody.code === 0) {
          setQuota(quotaBody.data ?? null);
        }
      } catch {
        if (!ignore) {
          setQuota(null);
        }
      }
    }

    void loadHistoryState();
    void loadQuotaState();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileRef.current) {
      return;
    }

    let cancelled = false;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (cancelled || !turnstileRef.current || !window.turnstile) {
        return;
      }
      turnstileWidgetRef.current = window.turnstile.render(
        turnstileRef.current,
        {
          sitekey: turnstileSiteKey,
          callback: setTurnstileToken,
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
        }
      );
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.remove();
    };
  }, [turnstileSiteKey]);

  async function generatePreview() {
    setStatus('generating');
    try {
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language,
          voice: selectedVoice,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const body = (await response.json()) as {
        code: number;
        data?: {
          audio?: {
            contentType?: string;
            audioBase64?: string;
          };
          request?: {
            characters?: number;
          };
          generation?: {
            reused?: boolean;
            monthlyQuotaCharacters?: number;
            extraCreditCharacters?: number;
          };
          history?: TextToSpeechHistoryItem[];
        };
      };
      const audio = body.data?.audio;
      if (
        !response.ok ||
        body.code !== 0 ||
        !audio?.contentType ||
        !audio.audioBase64
      ) {
        throw new Error('tts preview failed');
      }
      setAudioSrc(`data:${audio.contentType};base64,${audio.audioBase64}`);
      setHistory((current) =>
        mergeTextToSpeechHistory({
          current,
          incoming: body.data?.history ?? [],
        })
      );
      setQuota((current) =>
        current?.actorKind === 'user' && !body.data?.generation?.reused
          ? {
              ...current,
              monthlyUsedCharacters:
                current.monthlyUsedCharacters +
                (body.data?.generation?.monthlyQuotaCharacters ?? 0),
              monthlyRemainingCharacters: Math.max(
                0,
                current.monthlyRemainingCharacters -
                  (body.data?.generation?.monthlyQuotaCharacters ?? 0)
              ),
              extraCreditsRemaining: Math.max(
                0,
                current.extraCreditsRemaining -
                  (body.data?.generation?.extraCreditCharacters ?? 0)
              ),
            }
          : current
      );
      setStatus('ready');
      if (turnstileWidgetRef.current && window.turnstile) {
        window.turnstile.reset(turnstileWidgetRef.current);
        setTurnstileToken('');
      }
    } catch {
      setAudioSrc('');
      setStatus('error');
    }
  }

  return (
    <div className="mt-6 grid overflow-hidden rounded-lg border border-[#D7DEE8] bg-white shadow-sm lg:grid-cols-[1.08fr_0.92fr]">
      <div className="flex min-w-0 flex-col border-[#D7DEE8] lg:border-r">
        <div className="flex items-center justify-between gap-4 border-b border-[#E5EAF2] px-4 py-4 md:px-5">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
            <Volume2 className="size-4 text-[#2563EB]" />
            {copy.textLabel}
          </div>
          <div className="text-sm text-[#667085]">
            {text.length.toLocaleString()} {copy.characters}
          </div>
        </div>

        <div className="p-4 md:p-5">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-72 w-full resize-y rounded-md border border-[#D7DEE8] bg-[#FBFCFE] p-4 text-base leading-8 text-[#0F172A] transition outline-none focus:border-[#2563EB] focus:bg-white"
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[#344054]">
              {copy.samplePrompt}
            </span>
            {copy.samplePresets.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => applySamplePreset(sample.text)}
                className="inline-flex items-center gap-2 rounded-md border border-[#D7DEE8] bg-white px-3 py-2 text-sm font-medium text-[#344054] transition hover:border-[#2563EB] hover:text-[#1D4ED8]"
              >
                <FileText className="size-4" />
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto border-t border-[#E5EAF2] bg-[#F8FAFC] p-4 md:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.1fr]">
            <label className="text-sm font-medium text-[#344054]">
              {copy.languageLabel}
              <select
                value={language}
                onChange={(event) => {
                  const nextLanguage = event.target.value;
                  setLanguage(nextLanguage);
                  const nextVoice = TEXT_TO_SPEECH_VOICES.find(
                    (item) =>
                      item.language === nextLanguage ||
                      item.language === 'multi'
                  );
                  setVoice(nextVoice?.id ?? '');
                }}
                className="mt-2 h-10 w-full rounded-md border border-[#D7DEE8] bg-white px-3 text-[#0F172A] outline-none focus:border-[#2563EB]"
              >
                {TEXT_TO_SPEECH_LANGUAGES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                    {item.status === 'beta' ? ' beta' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-[#344054]">
              {copy.voiceLabel}
              <select
                value={selectedVoice}
                onChange={(event) => setVoice(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-[#D7DEE8] bg-white px-3 text-[#0F172A] outline-none focus:border-[#2563EB]"
              >
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                    {voice.isBeta ? ' beta' : ''}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="text-sm font-medium text-[#344054]">
                {copy.speedLabel}
              </legend>
              <div className="mt-2 grid h-10 grid-cols-4 overflow-hidden rounded-md border border-[#D7DEE8] bg-white">
                {TEXT_TO_SPEECH_PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => setPlaybackSpeed(speed)}
                    className={
                      playbackSpeed === speed
                        ? 'bg-[#2563EB] text-sm font-semibold text-white'
                        : 'border-l border-[#E5EAF2] text-sm font-medium text-[#344054] first:border-l-0 hover:bg-[#EEF4FF]'
                    }
                  >
                    {speed}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
            {turnstileSiteKey ? (
              <div className="rounded-md border border-[#D7DEE8] bg-white p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#344054]">
                  <ShieldCheck className="size-4 text-[#0F766E]" />
                  {copy.turnstileTitle}
                </div>
                <div ref={turnstileRef} className="min-h-16" aria-hidden />
              </div>
            ) : (
              <div className="rounded-md border border-[#D7DEE8] bg-white p-3 text-sm text-[#667085]">
                {copy.turnstileUnavailable}
              </div>
            )}

            <button
              type="button"
              disabled={isGenerating || !text.trim()}
              onClick={generatePreview}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Play className="size-4" />
              {isGenerating ? copy.generatingPreview : copy.generatePreview}
            </button>
          </div>

          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-[#667085]">
            <LockKeyhole className="size-4" />
            {copy.previewHint}
          </p>
        </div>
      </div>

      <div className="min-w-0 p-4 md:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
          <Play className="size-4 text-[#0F766E]" />
          {copy.audioTitle}
        </div>

        <div className="mt-4 rounded-md border border-[#D7DEE8] bg-[#FBFCFE] p-4">
          {audioSrc ? (
            <div>
              <audio
                ref={audioRef}
                controls
                src={audioSrc}
                className="w-full"
              />
              <div className="mt-3 flex items-center gap-2 text-sm font-medium text-[#0F766E]">
                <CheckCircle2 className="size-4" />
                {copy.previewReady}
              </div>
            </div>
          ) : status === 'error' ? (
            <div className="flex min-h-24 items-center justify-center text-center text-sm text-[#B42318]">
              {copy.previewError}
            </div>
          ) : (
            <div className="flex min-h-24 items-center justify-center text-center text-sm text-[#667085]">
              {copy.audioEmpty}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href={audioSrc || undefined}
            download="text-to-speech-preview.mp3"
            aria-disabled={!audioSrc}
            className="inline-flex min-h-14 items-center gap-3 rounded-md border border-[#D7DEE8] bg-white px-4 py-3 text-sm font-semibold text-[#0F172A] transition hover:bg-[#F8FAFC] aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            <Download className="size-5 text-[#344054]" />
            <span>
              {copy.downloadMp3}
              <span className="block text-xs font-normal text-[#667085]">
                {audioSrc ? copy.generatedFile : copy.generateFirst}
              </span>
            </span>
          </a>

          <Link
            href="/sign-in"
            className="inline-flex min-h-14 items-center gap-3 rounded-md bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
          >
            <LockKeyhole className="size-5" />
            <span>
              {copy.signInToDownload}
              <span className="block text-xs font-normal text-[#DBEAFE]">
                {copy.saveInHistory}
              </span>
            </span>
          </Link>
        </div>

        {quota ? (
          <div className="mt-5 grid gap-3 border-y border-[#E5EAF2] py-4 sm:grid-cols-3">
            {quota.actorKind === 'user' ? (
              <>
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-[#344054]">
                    <Play className="size-4 text-[#2563EB]" />
                    {copy.quotaTitle}
                  </div>
                  <div className="mt-1 text-sm text-[#0F172A]">
                    {quota.monthlyRemainingCharacters.toLocaleString()} /{' '}
                    {quota.monthlyCharacters.toLocaleString()}{' '}
                    {copy.quotaRemaining}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[#E5EAF2]">
                    <div
                      className="h-1.5 rounded-full bg-[#2563EB]"
                      style={{ width: `${quotaPercent ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="border-[#E5EAF2] sm:border-l sm:pl-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#344054]">
                    <Coins className="size-4 text-[#0F766E]" />
                    {copy.extraCredits}
                  </div>
                  <div className="mt-1 text-sm text-[#0F172A]">
                    {quota.extraCreditsRemaining.toLocaleString()}
                  </div>
                </div>
                <div className="border-[#E5EAF2] sm:border-l sm:pl-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#344054]">
                    <CalendarDays className="size-4 text-[#D97706]" />
                    {copy.resets}
                  </div>
                  <div className="mt-1 text-sm text-[#0F172A]">
                    {quota.resetAt
                      ? new Date(quota.resetAt).toLocaleDateString()
                      : copy.nextCycle}
                  </div>
                </div>
              </>
            ) : (
              <div className="sm:col-span-3">
                <div className="flex items-center gap-2 text-sm font-medium text-[#344054]">
                  <Play className="size-4 text-[#2563EB]" />
                  {copy.quotaTitle}
                </div>
                <div className="mt-1 text-sm text-[#0F172A]">
                  {quota.guestDailyPreviews.toLocaleString()}{' '}
                  {copy.previewsPerDay}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
            <History className="size-4 text-[#C2410C]" />
            {copy.recentHistory}
          </div>
          {history.length ? (
            <div className="mt-3 overflow-hidden rounded-md border border-[#D7DEE8]">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-2 border-t border-[#E5EAF2] bg-white px-3 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="line-clamp-1 text-sm font-medium text-[#0F172A]">
                      {item.textPreview}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#667085]">
                      <span>{item.language}</span>
                      <span>
                        {item.characterCount.toLocaleString()} {copy.characters}
                      </span>
                      <span>{item.status}</span>
                    </div>
                  </div>
                  {item.downloadAvailable ? (
                    <a
                      href={`/api/tts/download/${item.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-[#D7DEE8] bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] transition hover:bg-[#EEF4FF]"
                    >
                      <Download className="size-4" />
                      {copy.downloadMp3}
                    </a>
                  ) : (
                    <span className="text-xs text-[#667085]">
                      {copy.previewOnly}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-[#D7DEE8] bg-[#FBFCFE] px-4 py-5 text-sm text-[#667085]">
              {copy.historyEmpty}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
