'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, History, Play, Volume2 } from 'lucide-react';

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

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = Number(playbackSpeed.replace('x', ''));
    }
  }, [playbackSpeed, audioSrc]);

  useEffect(() => {
    let ignore = false;

    async function loadGeneratorState() {
      try {
        const [historyResponse, quotaResponse] = await Promise.all([
          fetch('/api/tts/history'),
          fetch('/api/tts/quota'),
        ]);
        const historyBody = (await historyResponse.json()) as {
          code: number;
          data?: { items?: TextToSpeechHistoryItem[] };
        };
        const quotaBody = (await quotaResponse.json()) as {
          code: number;
          data?: TextToSpeechQuotaSummary;
        };
        if (!ignore && historyResponse.ok && historyBody.code === 0) {
          setHistory(historyBody.data?.items ?? []);
        }
        if (!ignore && quotaResponse.ok && quotaBody.code === 0) {
          setQuota(quotaBody.data ?? null);
        }
      } catch {
        if (!ignore) {
          setHistory([]);
          setQuota(null);
        }
      }
    }

    void loadGeneratorState();

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
    <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-lg border border-[#D7DEE8] bg-white p-4 shadow-sm md:p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-[#344054]">
          <Volume2 className="size-4 text-[#2563EB]" />
          {copy.textLabel}
        </div>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="mt-3 min-h-48 w-full resize-y rounded-md border border-[#D7DEE8] bg-[#F8FAFC] p-3 text-base leading-7 text-[#111827] transition outline-none focus:border-[#2563EB] focus:bg-white"
        />
        <div className="mt-2 text-sm text-[#667085]">
          {text.length.toLocaleString()} {copy.characters}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-[#344054]">
            {copy.languageLabel}
            <select
              value={language}
              onChange={(event) => {
                const nextLanguage = event.target.value;
                setLanguage(nextLanguage);
                const nextVoice = TEXT_TO_SPEECH_VOICES.find(
                  (item) =>
                    item.language === nextLanguage || item.language === 'multi'
                );
                setVoice(nextVoice?.id ?? '');
              }}
              className="mt-2 w-full rounded-md border border-[#D7DEE8] bg-white px-3 py-2 text-[#111827] outline-none focus:border-[#2563EB]"
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
              className="mt-2 w-full rounded-md border border-[#D7DEE8] bg-white px-3 py-2 text-[#111827] outline-none focus:border-[#2563EB]"
            >
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label}
                  {voice.isBeta ? ' beta' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-[#344054]">
            {copy.speedLabel}
            <select
              value={playbackSpeed}
              onChange={(event) => setPlaybackSpeed(event.target.value)}
              className="mt-2 w-full rounded-md border border-[#D7DEE8] bg-white px-3 py-2 text-[#111827] outline-none focus:border-[#2563EB]"
            >
              {TEXT_TO_SPEECH_PLAYBACK_SPEEDS.map((speed) => (
                <option key={speed} value={speed}>
                  {speed}
                </option>
              ))}
            </select>
          </label>
        </div>

        {quota ? (
          <div className="mt-4 rounded-md border border-[#D7DEE8] bg-[#F8FAFC] px-3 py-2 text-sm text-[#344054]">
            {quota.actorKind === 'user' ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">{copy.quotaTitle}</span>
                <span>
                  {quota.monthlyRemainingCharacters.toLocaleString()} /{' '}
                  {quota.monthlyCharacters.toLocaleString()}{' '}
                  {copy.quotaRemaining}
                </span>
                <span>
                  {quota.extraCreditsRemaining.toLocaleString()}{' '}
                  {copy.extraCredits}
                </span>
                {quota.resetAt ? (
                  <span>
                    {copy.resets} {new Date(quota.resetAt).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">{copy.quotaTitle}</span>
                <span>
                  {quota.guestDailyPreviews.toLocaleString()}{' '}
                  {copy.previewsPerDay}
                </span>
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {turnstileSiteKey ? (
            <div
              ref={turnstileRef}
              className="min-h-16 w-full"
              aria-hidden="true"
            />
          ) : null}
          <button
            type="button"
            disabled={isGenerating}
            onClick={generatePreview}
            className="inline-flex items-center gap-2 rounded-md bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Play className="size-4" />
            {isGenerating ? copy.generatingPreview : copy.generatePreview}
          </button>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-md border border-[#D7DEE8] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F8FAFC]"
          >
            <Download className="size-4" />
            {copy.signInToDownload}
          </Link>
        </div>
      </div>

      <div className="grid gap-5">
        <div className="rounded-lg border border-[#D7DEE8] bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-[#344054]">
            <Play className="size-4 text-[#0F766E]" />
            {copy.audioTitle}
          </div>
          <div className="mt-4 flex min-h-32 items-center justify-center rounded-md border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 text-center text-sm text-[#667085]">
            {audioSrc ? (
              <div className="w-full">
                <audio
                  ref={audioRef}
                  controls
                  src={audioSrc}
                  className="w-full"
                />
                <div className="mt-3 text-sm text-[#0F766E]">
                  {copy.previewReady}
                </div>
              </div>
            ) : status === 'error' ? (
              copy.previewError
            ) : (
              copy.audioEmpty
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[#D7DEE8] bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-[#344054]">
            <History className="size-4 text-[#C2410C]" />
            {copy.recentHistory}
          </div>
          {history.length ? (
            <div className="mt-4 space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-[#EEF2F6] bg-[#F8FAFC] p-3"
                >
                  <div className="line-clamp-2 text-sm leading-6 font-medium text-[#111827]">
                    {item.textPreview}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#667085]">
                    <span>{item.language}</span>
                    <span>
                      {item.characterCount.toLocaleString()} {copy.characters}
                    </span>
                    <span>{item.status}</span>
                  </div>
                  {item.downloadAvailable ? (
                    <a
                      href={`/api/tts/download/${item.id}`}
                      className="mt-3 inline-flex items-center gap-2 rounded-md border border-[#D7DEE8] bg-white px-3 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#EEF4FF]"
                    >
                      <Download className="size-4" />
                      {copy.downloadMp3}
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-[#EEF2F6] bg-[#F8FAFC] px-4 py-5 text-sm text-[#667085]">
              {copy.historyEmpty}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
