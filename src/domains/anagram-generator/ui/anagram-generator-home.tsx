import type { AnagramGeneratorHomeCopy } from './anagram-generator-home-copy';
import { AnagramGeneratorWorkbench } from './anagram-generator-workbench';

export function AnagramGeneratorHome({
  copy,
}: {
  copy: AnagramGeneratorHomeCopy;
  locale: string;
}) {
  return (
    <div className="bg-[#f4f7f5] text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="container py-10 md:py-14">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <p className="text-xs font-extrabold tracking-[0.2em] text-emerald-800 uppercase">
                {copy.hero.eyebrow}
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
                {copy.hero.title}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
                {copy.hero.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {copy.hero.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <aside className="border-l-4 border-amber-500 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
              {copy.hero.note}
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
        <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {copy.examples.items.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-slate-200 bg-white p-5 font-semibold text-slate-700"
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <section id="how-to" className="border-y border-slate-200 bg-white">
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
                className="border-t-4 border-emerald-700 bg-slate-50 p-5"
              >
                <span className="text-sm font-black text-amber-700">
                  0{index + 1}
                </span>
                <h3 className="mt-3 text-lg font-extrabold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
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
          <ul className="grid gap-px overflow-hidden rounded-xl border border-slate-300 bg-slate-300 sm:grid-cols-2">
            {copy.limitations.items.map((item) => (
              <li
                key={item}
                className="bg-white p-5 text-sm leading-6 text-slate-600"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="container grid gap-px bg-slate-200 md:grid-cols-2">
          {copy.guides.map((guide) => (
            <article key={guide.title} className="bg-white px-6 py-10 lg:p-10">
              <h2 className="text-2xl font-black tracking-tight">
                {guide.title}
              </h2>
              {guide.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-4 leading-7 text-slate-600">
                  {paragraph}
                </p>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="container py-14 lg:py-18">
        <SectionHeading label={copy.faq.label} title={copy.faq.title} />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {copy.faq.items.map((item) => (
            <article
              key={item.question}
              className="rounded-xl border border-slate-200 bg-white p-6"
            >
              <h3 className="font-extrabold">{item.question}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {item.answer}
              </p>
            </article>
          ))}
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
      <p className="text-xs font-extrabold tracking-[0.18em] text-emerald-800 uppercase">
        {label}
      </p>
      <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-tight md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 max-w-3xl leading-7 text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}
