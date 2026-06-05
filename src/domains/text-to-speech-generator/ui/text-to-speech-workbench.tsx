'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, History, Play, Volume2 } from 'lucide-react';

import {
  TEXT_TO_SPEECH_LANGUAGES,
  TEXT_TO_SPEECH_PLAYBACK_SPEEDS,
  TEXT_TO_SPEECH_VOICES,
} from '../domain/config';
import type { TextToSpeechGeneratorHomeCopy } from './text-to-speech-home-copy';

export function TextToSpeechGeneratorWorkbench({
  copy,
}: {
  copy: TextToSpeechGeneratorHomeCopy['generator'];
}) {
  const [text, setText] = useState(copy.sampleText);
  const [language, setLanguage] = useState('en');
  const voices = useMemo(
    () =>
      TEXT_TO_SPEECH_VOICES.filter(
        (voice) =>
          voice.language === language || voice.modelId.includes('melotts')
      ),
    [language]
  );
  const selectedVoice = voices[0]?.id ?? '';

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
              onChange={(event) => setLanguage(event.target.value)}
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
              onChange={() => undefined}
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
            <select className="mt-2 w-full rounded-md border border-[#D7DEE8] bg-white px-3 py-2 text-[#111827] outline-none focus:border-[#2563EB]">
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
            disabled
            className="inline-flex items-center gap-2 rounded-md bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white opacity-70"
          >
            <Play className="size-4" />
            {copy.generatePreview}
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
            {copy.audioEmpty}
          </div>
        </div>

        <div className="rounded-lg border border-[#D7DEE8] bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-[#344054]">
            <History className="size-4 text-[#C2410C]" />
            {copy.recentHistory}
          </div>
          <div className="mt-4 rounded-md border border-[#EEF2F6] bg-[#F8FAFC] px-4 py-5 text-sm text-[#667085]">
            {copy.historyEmpty}
          </div>
        </div>
      </div>
    </div>
  );
}
