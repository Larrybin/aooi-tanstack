import {
  Download,
  FileVideo,
  Gauge,
  HelpCircle,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Zap,
} from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';

import type { Mp4CompressorHomeCopy } from './mp4-compressor-home-copy';
import { Mp4CompressorWorkbench } from './mp4-compressor-workbench';

const settingsIcons = [Gauge, SlidersHorizontal, Zap] as const;

export function Mp4CompressorHome({
  copy,
}: {
  copy: Mp4CompressorHomeCopy;
  locale: string;
}) {
  return (
    <div className="bg-[#F8FBFF] text-[#10182B]">
      <section className="border-b border-[#DCE6F3] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FBFF_100%)]">
        <div className="container py-8 md:py-12">
          <Mp4CompressorWorkbench copy={copy.workbench} />
        </div>
      </section>

      <section id="how-to" className="container py-12 lg:py-16">
        <h2 className="text-center text-3xl font-semibold tracking-normal text-[#10182B]">
          {copy.howTo.title}
        </h2>
        <div className="mt-9 grid gap-7 md:grid-cols-3">
          {copy.howTo.steps.map((step, index) => {
            const Icon = index === 0 ? Upload : index === 1 ? Gauge : Download;
            return (
              <div key={step.title} className="text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#EAF3FF] text-[#0F5AE8]">
                  <Icon className="size-7" />
                </div>
                <div className="mx-auto mt-4 flex size-7 items-center justify-center rounded-full bg-[#08744B] text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#10182B]">
                  {step.title}
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#475569]">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="settings" className="container py-12 lg:py-16">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-normal text-[#10182B]">
            {copy.settings.title}
          </h2>
          <p className="mt-3 text-base text-[#475569]">
            {copy.settings.description}
          </p>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {copy.settings.items.map((item, index) => {
            const Icon = settingsIcons[index] ?? FileVideo;
            return (
              <div
                key={item.title}
                className={[
                  'rounded-lg border bg-white p-6',
                  item.label
                    ? 'border-[#0B8F62] shadow-[0_18px_48px_rgba(8,116,75,0.12)]'
                    : 'border-[#D7E0ED]',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-3">
                  <Icon
                    className={[
                      'size-7',
                      item.label ? 'text-[#08744B]' : 'text-[#0F5AE8]',
                    ].join(' ')}
                  />
                  {item.label ? (
                    <span className="rounded-md bg-[#DFF8EC] px-3 py-1 text-xs font-semibold text-[#08744B]">
                      {item.label}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#10182B]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#475569]">
                  {item.description}
                </p>
                <ul className="mt-5 space-y-2 text-sm text-[#172033]">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="mt-2 size-1.5 rounded-full bg-[#0F5AE8]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-5 rounded-md border border-[#BFD7FF] bg-[#EFF6FF] px-4 py-3 text-sm text-[#164892]">
          {copy.settings.note}
        </p>
      </section>

      <section id="faq" className="container py-12 lg:py-16">
        <h2 className="text-center text-3xl font-semibold tracking-normal text-[#10182B]">
          {copy.faq.title}
        </h2>
        <Accordion
          type="single"
          collapsible
          className="mx-auto mt-8 max-w-5xl rounded-lg border border-[#D7E0ED] bg-white"
        >
          {copy.faq.items.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger className="px-5 text-base hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="px-5 leading-7 text-[#475569]">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="border-t border-[#DCE6F3] bg-white">
        <div className="container grid gap-6 py-8 md:grid-cols-3">
          {copy.footerTrust.map((item, index) => {
            const Icon =
              index === 0 ? ShieldCheck : index === 1 ? Zap : HelpCircle;
            return (
              <div key={item.title} className="flex gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#EAF3FF] text-[#0F5AE8]">
                  <Icon className="size-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#10182B]">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#475569]">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
