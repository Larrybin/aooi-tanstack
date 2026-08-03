import { Check, ShieldCheck } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';

import type { CalculatorHomeCopy } from './401k-calculator-home-copy';
import { CalculatorWorkbench } from './401k-calculator-workbench';

export function CalculatorHome({
  copy,
}: {
  copy: CalculatorHomeCopy;
  locale: string;
}) {
  return (
    <div className="bg-[#F4F7F5] text-[#173526]">
      <section className="border-b border-[#D8E3DC] bg-[radial-gradient(circle_at_top_right,rgba(126,214,159,0.18),transparent_34%),linear-gradient(180deg,#FFFFFF_0%,#F3F7F4_100%)]">
        <div className="container py-10 md:py-14">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-[#2E7D50] uppercase">
                Free retirement projection tool
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#153724] md:text-6xl">
                {copy.hero.title}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-[#4D6757]">
                {copy.hero.description}
              </p>
              <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#BFD7C8] bg-white px-4 py-2 text-sm font-medium text-[#315D45]">
                <ShieldCheck className="size-4" aria-hidden="true" />
                {copy.hero.privacyNote}
              </p>
            </div>
            <aside className="rounded-2xl border border-[#CFE0D5] bg-white p-5 shadow-[0_14px_40px_rgba(20,60,38,0.06)]">
              <h2 className="font-semibold text-[#173526]">
                {copy.hero.includesTitle}
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-[#4D6757]">
                {copy.hero.includes.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="flex size-6 items-center justify-center rounded-full bg-[#E1F3E7] text-[#26724A]">
                      <Check className="size-4" aria-hidden="true" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          <div className="mt-8">
            <CalculatorWorkbench copy={copy} />
          </div>
        </div>
      </section>

      <section id="formula" className="container py-14 lg:py-18">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <SectionKicker index="03">{copy.formula.label}</SectionKicker>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#153724]">
              {copy.formula.title}
            </h2>
            <p className="mt-4 max-w-3xl leading-7 text-[#52695B]">
              {copy.formula.description}
            </p>
            <div className="mt-6 space-y-2 rounded-2xl border border-[#CFE0D5] bg-white p-5 shadow-[0_12px_36px_rgba(20,60,38,0.05)]">
              {copy.formula.lines.map((line) => (
                <code
                  key={line}
                  className="block overflow-x-auto rounded-lg bg-[#F1F6F3] px-4 py-3 text-sm text-[#24543A]"
                >
                  {line}
                </code>
              ))}
            </div>
          </div>
          <aside className="self-start rounded-2xl bg-[#173D29] p-6 text-white">
            <h3 className="text-xl font-semibold">
              {copy.formula.estimateTitle}
            </h3>
            <p className="mt-3 text-sm leading-7 text-[#C9E2D2]">
              {copy.formula.estimateDescription}
            </p>
          </aside>
        </div>
      </section>

      <section id="guide" className="border-y border-[#D8E3DC] bg-white">
        <div className="container py-14 lg:py-18">
          <SectionKicker index="04">{copy.guide.label}</SectionKicker>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#153724]">
            {copy.guide.title}
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {copy.guide.steps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-2xl border border-[#D5E1D9] bg-[#F7FAF8] p-5"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-[#26724A] text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-5 font-semibold text-[#173526]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#607267]">
                  {step.description}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-14 border-t border-[#D8E3DC] pt-12">
            <SectionKicker index="04.1">
              {copy.inputExplanations.label}
            </SectionKicker>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#153724]">
              {copy.inputExplanations.title}
            </h2>
            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="grid gap-4 md:grid-cols-2">
                {copy.inputExplanations.items.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-2xl border border-[#D5E1D9] bg-[#F7FAF8] p-5"
                  >
                    <h3 className="font-semibold text-[#173526]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#607267]">
                      {item.description}
                    </p>
                  </article>
                ))}
              </div>
              <aside className="self-start rounded-2xl bg-[#173D29] p-6 text-white">
                <h3 className="text-xl font-semibold">
                  {copy.inputExplanations.reminderTitle}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#C9E2D2]">
                  {copy.inputExplanations.reminderDescription}
                </p>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section
        className="border-b border-[#D8E3DC] bg-[#EDF5F0]"
        aria-labelledby="trust-methodology-heading"
      >
        <div className="container py-14 lg:py-18">
          <SectionKicker index="05">{copy.trust.label}</SectionKicker>
          <div className="mt-3 grid gap-6 rounded-2xl border border-[#C9DCCF] bg-white p-6 shadow-[0_12px_36px_rgba(20,60,38,0.05)] md:p-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              <h2
                id="trust-methodology-heading"
                className="text-3xl font-semibold tracking-tight text-[#153724]"
              >
                {copy.trust.title}
              </h2>
              <p className="mt-4 max-w-3xl leading-7 text-[#52695B]">
                {copy.trust.description}
              </p>
              <a
                href="/methodology"
                className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[#26724A] px-5 text-sm font-semibold text-white transition hover:bg-[#1F613E]"
              >
                {copy.trust.methodologyLink}
              </a>
            </div>
            <aside className="self-start rounded-xl bg-[#173D29] p-5 text-sm leading-7 text-[#DCECE2]">
              <p className="font-semibold text-white">
                {copy.trust.maintainedBy}
              </p>
              <p className="mt-2">{copy.trust.lastReviewed}</p>
            </aside>
          </div>
        </div>
      </section>

      <section id="faq" className="container py-14 lg:py-18">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-[#153724]">
          {copy.faq.title}
        </h2>
        <Accordion
          type="single"
          collapsible
          className="mx-auto mt-8 max-w-4xl rounded-2xl border border-[#D5E1D9] bg-white px-5"
        >
          {copy.faq.items.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger className="text-left text-base hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="leading-7 text-[#607267]">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}

function SectionKicker({
  children,
  index,
}: {
  children: string;
  index: string;
}) {
  return (
    <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-[#367652] uppercase">
      <span className="size-2 rounded-full bg-[#2E8B57]" />
      <span>{index}</span>
      <span>{children}</span>
    </p>
  );
}
