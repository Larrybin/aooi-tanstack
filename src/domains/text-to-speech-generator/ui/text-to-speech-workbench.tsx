'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, History, Play, Volume2 } from 'lucide-react';

import {
  TEXT_TO_SPEECH_LANGUAGES,
  TEXT_TO_SPEECH_PLAYBACK_SPEEDS,
  TEXT_TO_SPEECH_VOICES,
} from '../domain/config';
import type { TextToSpeechGeneratorHomeCopy } from './text-to-speech-home-copy';

type TextToSpeechHistoryItem = {
  id: string;
  status: string;
  textPreview: string;
  characterCount: number;
  language: string;
  voice: string;
  model: string;
  outputFormat: string;
  createdAt: string;
  expiresAt: string;
  audioAvailable: boolean;
  downloadAvailable: boolean;
};

export function TextToSpeechGeneratorWorkbench({
  copy,
}: {
  copy: TextToSpeechGeneratorHomeCopy['generator'];
}) {
  const [text, setText] = useState(copy.sampleText);
  const [language, setLanguage] = useState('en');
  const [voice, setVoice] = useState('aura-asteria-en');
  const [playbackSpeed, setPlaybackSpeed] = useState('1x');
  const [audioSrc, setAudioSrc] = useState('');
  const [history, setHistory] = useState<TextToSpeechHistoryItem[]>([]);
  const [status, setStatus] = useState<
    'idle' | 'generating' | 'ready' | 'error'
  >('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

    async function loadHistory() {
      try {
        const response = await fetch('/api/tts/history');
        const body = (await response.json()) as {
          code: number;
          data?: {
            items?: TextToSpeechHistoryItem[];
          };
        };
        if (!ignore && response.ok && body.code === 0) {
          setHistory(body.data?.items ?? []);
        }
      } catch {
        if (!ignore) {
          setHistory([]);
        }
      }
    }

    void loadHistory();

    return () => {
      ignore = true;
    };
  }, []);

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
        }),
      });
      const body = (await response.json()) as {
        code: number;
        data?: {
          audio?: {
            contentType?: string;
            audioBase64?: string;
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
      setHistory(body.data?.history ?? []);
      setStatus('ready');
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

        <div className="mt-5 flex flex-wrap gap-3">
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
