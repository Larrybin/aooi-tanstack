import Link from 'next/link';
import {
  BadgeInfo,
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
    <div className="bg-[#FBFCFE] text-[#0F172A]">
      <section className="border-b border-[#D7DEE8] bg-[linear-gradient(180deg,#FFFFFF,#F3F7FC)]">
        <div className="container py-6 md:py-8">
          <div className="max-w-5xl">
            <h1 className="text-4xl font-semibold tracking-normal text-[#0F172A] sm:text-5xl">
              {copy.hero.title}
            </h1>
            <p className="mt-3 max-w-6xl text-lg leading-8 text-[#475467]">
              {copy.hero.description}
            </p>
          </div>

          <TextToSpeechGeneratorWorkbench
            copy={copy.generator}
            turnstileSiteKey={turnstileSiteKey}
          />

          <div className="mt-8">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-[#D7DEE8]" />
              <h2 className="text-base font-semibold text-[#0F172A]">
                {copy.sections.explore.title}
              </h2>
              <div className="h-px flex-1 bg-[#D7DEE8]" />
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {copy.sections.explore.links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D7DEE8] bg-white px-4 py-2 text-sm font-medium text-[#344054] transition hover:border-[#2563EB] hover:text-[#1D4ED8]"
                >
                  {item.label === 'Pricing' ? (
                    <BadgeInfo className="size-4" />
                  ) : item.label === 'Privacy Policy' ? (
                    <ShieldCheck className="size-4" />
                  ) : (
                    <BookOpenText className="size-4" />
                  )}
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
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
