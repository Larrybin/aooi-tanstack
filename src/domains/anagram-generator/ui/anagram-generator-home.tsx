import type { AnagramGeneratorHomeCopy } from './anagram-generator-home-copy';
import { AnagramGeneratorWorkbench } from './anagram-generator-workbench';

export function AnagramGeneratorHome({
  copy,
}: {
  copy: AnagramGeneratorHomeCopy;
  locale: string;
}) {
  return (
    <div className="bg-[#FBFCFE] text-[#0F172A]">
      <section className="border-b border-[#E6EBF2] bg-[linear-gradient(180deg,#FFFFFF_0%,#F4F7FB_100%)]">
        <div className="container py-10 md:py-14">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-end">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-[#3452C7] uppercase">
                {copy.hero.eyebrow}
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
                {copy.hero.title}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-[#475569]">
                {copy.hero.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {copy.hero.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#C8D4FF] bg-[#E6EEFF] px-3 py-1 font-mono text-xs font-semibold text-[#2742A3]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <aside className="border-l-4 border-[#B7791F] bg-white p-5 text-sm leading-6 text-[#475569] shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <p className="font-semibold text-[#0F172A]">
                {copy.hero.noteTitle}
              </p>
              <p className="mt-2">{copy.hero.note}</p>
            </aside>
          </div>

          <div className="mt-8">
            <AnagramGeneratorWorkbench copy={copy.workbench} />
          </div>
        </div>
      </section>

      <section id="examples" className="container py-14 lg:py-18">
        <SectionHeading
          label={copy.examples.label}
          title={copy.examples.title}
          description={copy.examples.description}
        />
        <div className="mt-8 grid overflow-hidden border border-[#D7DEE8] bg-[#D7DEE8] sm:grid-cols-2 xl:grid-cols-5">
          {copy.examples.items.map((item, index) => (
            <div key={item} className="bg-white p-5">
              <span className="font-mono text-xs font-semibold text-[#64748B]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="mt-3 text-sm leading-6 font-semibold text-[#334155]">
                {item}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-to" className="border-y border-[#E6EBF2] bg-white">
        <div className="container py-14 lg:py-18">
          <SectionHeading
            label={copy.howTo.label}
            title={copy.howTo.title}
            description={copy.howTo.description}
          />
          <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {copy.howTo.steps.map((step, index) => (
              <li
                key={step.title}
                className="border-t-4 border-[#4F6EF7] bg-[#F4F7FB] p-5"
              >
                <span className="font-mono text-sm font-bold text-[#3452C7]">
                  0{index + 1}
                </span>
                <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#475569]">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="limitations" className="container py-14 lg:py-18">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading
            label={copy.limitations.label}
            title={copy.limitations.title}
            description={copy.limitations.description}
          />
          <ul className="grid gap-px overflow-hidden border border-[#D7DEE8] bg-[#D7DEE8] sm:grid-cols-2">
            {copy.limitations.items.map((item) => (
              <li
                key={item}
                className="bg-white p-5 text-sm leading-6 text-[#475569]"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-[#E6EBF2] bg-white">
        <div className="container grid gap-px bg-[#E6EBF2] md:grid-cols-2">
          {copy.guides.map((guide) => (
            <article key={guide.title} className="bg-white px-6 py-10 lg:p-10">
              <h2 className="text-2xl font-bold tracking-tight">
                {guide.title}
              </h2>
              {guide.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-4 leading-7 text-[#475569]">
                  {paragraph}
                </p>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="bg-[#F4F7FB]">
        <div className="container py-14 lg:py-18">
          <SectionHeading label={copy.faq.label} title={copy.faq.title} />
          <div className="mt-8 grid gap-px overflow-hidden border border-[#D7DEE8] bg-[#D7DEE8] md:grid-cols-2">
            {copy.faq.items.map((item) => (
              <article key={item.question} className="bg-white p-6">
                <h3 className="font-bold">{item.question}</h3>
                <p className="mt-3 text-sm leading-6 text-[#475569]">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold tracking-[0.18em] text-[#3452C7] uppercase">
        {label}
      </p>
      <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-tight md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 max-w-3xl leading-7 text-[#475569]">{description}</p>
      ) : null}
    </div>
  );
}
