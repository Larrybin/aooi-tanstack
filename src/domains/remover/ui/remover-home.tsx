import Link from 'next/link';
import {
  ArrowRight,
  Brush,
  Check,
  Download,
  Images,
  Lock,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2,
  Zap,
} from 'lucide-react';

import { RemoverEditorEntry } from './remover-editor';
import type { RemoverHomeCopy } from './remover-home-copy';

const featureIcons = [Brush, Images, ShieldCheck, Zap];

function withLocale(path: string, locale: string): string {
  if (!locale || locale === 'en') {
    return path;
  }

  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

function ProcessExample({ copy }: { copy: RemoverHomeCopy['processExample'] }) {
  return (
    <div className="grid overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:grid-cols-2">
      <div className="relative min-h-72 overflow-hidden bg-[linear-gradient(135deg,#d7f0ec,#f8d7bf_48%,#d9e8ff)]">
        <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.24))]" />
        <div className="absolute top-10 left-10 h-28 w-20 rounded-lg bg-white/70 shadow-sm" />
        <div className="absolute top-20 right-16 h-24 w-16 rounded-full bg-slate-900/70" />
        <div className="absolute right-10 bottom-12 h-20 w-28 rounded-lg bg-amber-300/80 shadow-sm" />
        <div className="absolute bottom-8 left-12 h-16 w-36 rounded-lg bg-white/80 shadow-sm" />
        <div className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700">
          {copy.before}
        </div>
        <div className="absolute top-16 right-10 rounded-full border border-rose-400 bg-rose-100/80 px-3 py-1 text-xs font-medium text-rose-800">
          {copy.distraction}
        </div>
      </div>

      <div className="relative min-h-72 overflow-hidden bg-[linear-gradient(135deg,#d7f0ec,#f8d7bf_48%,#d9e8ff)]">
        <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.18))]" />
        <div className="absolute top-10 left-10 h-28 w-20 rounded-lg bg-white/70 shadow-sm" />
        <div className="absolute bottom-8 left-12 h-16 w-36 rounded-lg bg-white/80 shadow-sm" />
        <div className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700">
          {copy.after}
        </div>
        <div className="absolute right-6 bottom-6 flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-sm">
          <Check className="size-3" />
          {copy.cleanResult}
        </div>
      </div>
    </div>
  );
}

export function RemoverHome({
  copy,
  locale,
}: {
  copy: RemoverHomeCopy;
  locale: string;
}) {
  const pricingHref = withLocale('/pricing', locale);

  return (
    <div className="bg-[#f7faf8] text-slate-950">
      <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,#d7f0ec,transparent_32%),linear-gradient(180deg,#ffffff,#f7faf8)]">
        <div className="container grid gap-10 py-10 md:grid-cols-[minmax(0,1fr)_minmax(380px,0.88fr)] md:items-center md:py-14 lg:py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-sm font-medium text-teal-800">
              <Sparkles className="size-4" />
              {copy.hero.badge}
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
              {copy.hero.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              {copy.hero.description}
            </p>
            <div className="mt-7 grid max-w-2xl gap-3 sm:grid-cols-2">
              {copy.hero.useCases.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <Check className="size-4 text-emerald-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <RemoverEditorEntry copy={copy.editor} locale={locale} />
        </div>
      </section>

      <section className="container py-12 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold tracking-normal text-teal-700 uppercase">
              {copy.beforeAfter.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              {copy.beforeAfter.title}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {copy.beforeAfter.description}
            </p>
          </div>
          <ProcessExample copy={copy.processExample} />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="container py-12 lg:py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-normal text-teal-700 uppercase">
              {copy.howItWorks.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              {copy.howItWorks.title}
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {copy.howItWorks.steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-lg border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-white text-slate-950 shadow-sm">
                  {index === 0 ? <Upload className="size-5" /> : null}
                  {index === 1 ? <Brush className="size-5" /> : null}
                  {index === 2 ? <Wand2 className="size-5" /> : null}
                  {index === 3 ? <Download className="size-5" /> : null}
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-12 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <div>
            <p className="text-sm font-semibold tracking-normal text-teal-700 uppercase">
              {copy.useCasesSection.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              {copy.useCasesSection.title}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {copy.useCasesSection.description}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {copy.useCasesSection.examples.map((example) => (
              <div
                key={example.title}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h3 className="font-semibold">{example.title}</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="rounded-lg bg-rose-50 p-3 text-rose-800">
                    {copy.useCasesSection.beforePrefix} {example.before}
                  </p>
                  <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">
                    {copy.useCasesSection.afterPrefix} {example.after}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="container py-12 lg:py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-normal text-teal-700 uppercase">
              {copy.featuresSection.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              {copy.featuresSection.title}
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {copy.featuresSection.features.map((feature, index) => {
              const Icon = featureIcons[index] ?? Brush;
              return (
                <div
                  key={feature.title}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-5"
                >
                  <Icon className="size-6 text-teal-700" />
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container grid gap-8 py-12 lg:grid-cols-2 lg:items-center lg:py-16">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <Lock className="size-6" />
            </div>
            <h2 className="text-2xl font-semibold">{copy.privacy.title}</h2>
          </div>
          <p className="mt-4 text-base leading-7 text-slate-600">
            {copy.privacy.description}
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h3 className="text-xl font-semibold text-amber-950">
            {copy.policy.title}
          </h3>
          <p className="mt-3 text-base leading-7 text-amber-900">
            {copy.policy.description}
          </p>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-950 text-white">
        <div className="container flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold">{copy.cta.title}</h2>
            <p className="mt-2 max-w-xl text-slate-300">
              {copy.cta.description}
            </p>
          </div>
          <Link
            href={pricingHref}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
          >
            {copy.cta.button}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <section className="container py-12 lg:py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-normal text-teal-700 uppercase">
            {copy.faqSection.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            {copy.faqSection.title}
          </h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {copy.faqSection.items.map((item) => (
            <div
              key={item.question}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="font-semibold">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
