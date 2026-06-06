import {
  BadgeCheck,
  BookOpenText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';

import type { TextToSpeechGeneratorHomeCopy } from './text-to-speech-home-copy';
import { TextToSpeechGeneratorWorkbench } from './text-to-speech-workbench';

export function TextToSpeechGeneratorHome({
  copy,
  turnstileSiteKey,
}: {
  copy: TextToSpeechGeneratorHomeCopy;
  locale: string;
  turnstileSiteKey: string;
}) {
  return (
    <div className="bg-[#F8FAFC] text-[#111827]">
      <section className="border-b border-[#D7DEE8] bg-[linear-gradient(180deg,#FFFFFF,#EEF6FF)]">
        <div className="container py-8 md:py-12 lg:py-14">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-[#BFDBFE] bg-white px-3 py-1 text-sm font-medium text-[#1E3A8A] shadow-sm">
              <BookOpenText className="size-4 text-[#2563EB]" />
              {copy.hero.badge}
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-[#111827] sm:text-5xl lg:text-6xl">
              {copy.hero.title}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[#344054] sm:text-xl">
              {copy.hero.description}
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-3 text-sm text-[#344054]">
            {copy.hero.trustNotes.map((note) => (
              <span
                key={note}
                className="inline-flex items-center gap-2 rounded-md border border-[#D7DEE8] bg-white px-3 py-2"
              >
                <BadgeCheck className="size-4 text-[#0F766E]" />
                {note}
              </span>
            ))}
          </div>

          <TextToSpeechGeneratorWorkbench
            copy={copy.generator}
            turnstileSiteKey={turnstileSiteKey}
          />
        </div>
      </section>

      <section className="container grid gap-8 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:py-16">
        <div>
          <p className="text-sm font-semibold tracking-normal text-[#2563EB] uppercase">
            {copy.sections.workflow.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[#111827]">
            {copy.sections.workflow.title}
          </h2>
          <p className="mt-4 text-base leading-7 text-[#344054]">
            {copy.sections.workflow.description}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {copy.sections.workflow.items.map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-lg border border-[#D7DEE8] bg-white p-4 shadow-sm"
            >
              <BookOpenText className="size-5 text-[#2563EB]" />
              <span className="font-medium text-[#111827]">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#D7DEE8] bg-white">
        <div className="container grid gap-5 py-12 lg:grid-cols-2 lg:py-16">
          <div className="rounded-lg border border-[#D7DEE8] bg-[#F8FAFC] p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-[#DCFCE7] text-[#0F766E]">
                <ShieldCheck className="size-6" />
              </div>
              <h2 className="text-2xl font-semibold text-[#111827]">
                {copy.sections.privacy.title}
              </h2>
            </div>
            <p className="mt-4 text-base leading-7 text-[#344054]">
              {copy.sections.privacy.description}
            </p>
          </div>

          <div className="rounded-lg border border-[#D7DEE8] bg-[#172554] p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-white/10 text-white">
                <WalletCards className="size-6" />
              </div>
              <h2 className="text-2xl font-semibold">
                {copy.sections.limits.title}
              </h2>
            </div>
            <p className="mt-4 text-base leading-7 text-[#DBEAFE]">
              {copy.sections.limits.description}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
