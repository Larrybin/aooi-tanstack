import type { RandomGroupGeneratorHomeCopy } from './random-group-generator-home-copy';
import { RandomGroupGeneratorWorkbench } from './random-group-generator-workbench';

export function RandomGroupGeneratorHome({
  copy,
}: {
  copy: RandomGroupGeneratorHomeCopy;
  locale: string;
}) {
  return (
    <div className="bg-[#F7F4ED] text-[#1F323F]">
      <section className="border-b border-[#CBD3D9] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7F4ED_100%)]">
        <div className="container py-9 md:py-12">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-end">
            <div>
              <p className="text-xs font-black tracking-[0.2em] text-[#B84433] uppercase">
                {copy.hero.eyebrow}
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-[#1F323F] md:text-6xl">
                {copy.hero.title}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-[#586974]">
                {copy.hero.description}
              </p>
            </div>
            <aside className="border-l-4 border-[#D95A46] bg-[#FFF8E8] p-5">
              <h2 className="font-black text-[#1F323F]">
                {copy.hero.noteTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#586974]">
                {copy.hero.noteDescription}
              </p>
            </aside>
          </div>

          <div className="mt-8">
            <RandomGroupGeneratorWorkbench copy={copy.workbench} />
          </div>
        </div>
      </section>

      <section id="how-to" className="container py-14 lg:py-18">
        <SectionHeading label={copy.howTo.label} title={copy.howTo.title} />
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {copy.howTo.steps.map((step, index) => (
            <article
              key={step.title}
              className="border-t-4 border-[#2859A8] bg-white p-5 shadow-[0_10px_30px_rgba(31,50,63,0.05)]"
            >
              <span className="text-sm font-black text-[#B84433]">
                0{index + 1}
              </span>
              <h3 className="mt-4 text-lg font-black text-[#1F323F]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#5B6A74]">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#CBD3D9] bg-white">
        <div className="container grid gap-px bg-[#CBD3D9] md:grid-cols-2">
          {copy.guides.map((guide) => (
            <article key={guide.title} className="bg-white px-6 py-10 lg:p-10">
              <h2 className="text-2xl font-black tracking-tight text-[#1F323F]">
                {guide.title}
              </h2>
              {guide.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-4 leading-7 text-[#5B6A74]">
                  {paragraph}
                </p>
              ))}
              {guide.points ? (
                <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-6 text-[#4E606C]">
                  {guide.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="container py-14 lg:py-18">
        <SectionHeading
          label={copy.examples.label}
          title={copy.examples.title}
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {copy.examples.items.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-[#CBD3D9] bg-[#FFFDF8] p-5"
            >
              <h3 className="font-black text-[#1F323F]">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#5B6A74]">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="border-t border-[#CBD3D9] bg-[#EAF5F0]">
        <div className="container py-14 lg:py-18">
          <SectionHeading label={copy.faq.label} title={copy.faq.title} />
          <div className="mt-8 grid gap-px overflow-hidden border border-[#AAB7C3] bg-[#AAB7C3] md:grid-cols-2">
            {copy.faq.items.map((item) => (
              <article key={item.question} className="bg-white p-6">
                <h3 className="font-black text-[#1F323F]">{item.question}</h3>
                <p className="mt-3 text-sm leading-6 text-[#5B6A74]">
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

function SectionHeading({ label, title }: { label: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-black tracking-[0.18em] text-[#B84433] uppercase">
        {label}
      </p>
      <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-[#1F323F] md:text-4xl">
        {title}
      </h2>
    </div>
  );
}
