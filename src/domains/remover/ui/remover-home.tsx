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

const steps = [
  { title: 'Upload', description: 'Choose a JPG, PNG, or WebP photo.' },
  { title: 'Brush', description: 'Paint over the object or person to remove.' },
  { title: 'Remove', description: 'AI fills the selected area in seconds.' },
  { title: 'Download', description: 'Save a clean low-res result for free.' },
];

const examples = [
  {
    title: 'Clean travel photos',
    before: 'Tourists and street clutter',
    after: 'A clear landmark shot',
  },
  {
    title: 'Remove background distractions',
    before: 'Cables, trash cans, and signs',
    after: 'A calmer composition',
  },
  {
    title: 'Polish creator assets',
    before: 'Objects pulling focus',
    after: 'Ready-to-post visuals',
  },
];

const useCases = [
  'Remove unwanted objects from daily photos',
  'Remove people from travel and event photos',
  'Clean social media images before posting',
  'Fix background distractions in creator assets',
];

const features = [
  {
    icon: Brush,
    title: 'Brush-based selection',
    description:
      'Mark only the area you want changed. Keep the rest of the photo intact.',
  },
  {
    icon: Images,
    title: 'Before and after preview',
    description:
      'Compare the original and cleaned result before deciding what to download.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacy-aware retention',
    description:
      'Images are used for processing, not training, and expire automatically.',
  },
  {
    icon: Zap,
    title: 'Fast browser workflow',
    description:
      'Start without a heavy editor, project setup, or mandatory sign-up.',
  },
];

const faqs = [
  {
    question: 'Can I try AI Remover without signing up?',
    answer:
      'Yes. Guests can process a limited number of images and download low-res results without creating an account.',
  },
  {
    question: 'What image formats are supported?',
    answer:
      'The MVP supports JPG, PNG, and WebP uploads. File size limits depend on your plan.',
  },
  {
    question: 'Are uploaded images used for training?',
    answer:
      'No. Uploaded images are used to process your removal job and provide your result. They are not used to train AI models.',
  },
  {
    question: 'Can I remove watermarks or logos?',
    answer:
      'No. AI Remover is for legitimate photo cleanup. It must not be used to remove copyright watermarks, brand logos, or authorization marks.',
  },
];

function ProcessExample() {
  return (
    <div className="grid overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:grid-cols-2">
      <div className="relative min-h-72 overflow-hidden bg-[linear-gradient(135deg,#d7f0ec,#f8d7bf_48%,#d9e8ff)]">
        <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.24))]" />
        <div className="absolute top-10 left-10 h-28 w-20 rounded-lg bg-white/70 shadow-sm" />
        <div className="absolute top-20 right-16 h-24 w-16 rounded-full bg-slate-900/70" />
        <div className="absolute right-10 bottom-12 h-20 w-28 rounded-lg bg-amber-300/80 shadow-sm" />
        <div className="absolute bottom-8 left-12 h-16 w-36 rounded-lg bg-white/80 shadow-sm" />
        <div className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700">
          Before
        </div>
        <div className="absolute top-16 right-10 rounded-full border border-rose-400 bg-rose-100/80 px-3 py-1 text-xs font-medium text-rose-800">
          distraction
        </div>
      </div>

      <div className="relative min-h-72 overflow-hidden bg-[linear-gradient(135deg,#d7f0ec,#f8d7bf_48%,#d9e8ff)]">
        <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.18))]" />
        <div className="absolute top-10 left-10 h-28 w-20 rounded-lg bg-white/70 shadow-sm" />
        <div className="absolute bottom-8 left-12 h-16 w-36 rounded-lg bg-white/80 shadow-sm" />
        <div className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700">
          After
        </div>
        <div className="absolute right-6 bottom-6 flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-sm">
          <Check className="size-3" />
          Clean result
        </div>
      </div>
    </div>
  );
}

export function RemoverHome() {
  return (
    <div className="bg-[#f7faf8] text-slate-950">
      <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,#d7f0ec,transparent_32%),linear-gradient(180deg,#ffffff,#f7faf8)]">
        <div className="container grid gap-10 py-10 md:grid-cols-[minmax(0,1fr)_minmax(380px,0.88fr)] md:items-center md:py-14 lg:py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-sm font-medium text-teal-800">
              <Sparkles className="size-4" />
              Free to try
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
              AI Object Remover
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              Remove unwanted objects, people, and distractions from photos in
              seconds.
            </p>
            <div className="mt-7 grid max-w-2xl gap-3 sm:grid-cols-2">
              {useCases.map((item) => (
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

          <RemoverEditorEntry />
        </div>
      </section>

      <section className="container py-12 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold tracking-normal text-teal-700 uppercase">
              Before / After
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              Clean the photo without opening a heavy editor.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Brush over the object, person, or background detail you want gone.
              AI Remover creates a cleaned result while preserving the rest of
              your image.
            </p>
          </div>
          <ProcessExample />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="container py-12 lg:py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-normal text-teal-700 uppercase">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Four steps, one clean result.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {steps.map((step, index) => (
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
              Use cases
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Built for quick photo cleanup.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              The MVP stays focused on removing visible distractions from normal
              photos and creator assets. No project setup. No complex export
              panel.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {examples.map((example) => (
              <div
                key={example.title}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h3 className="font-semibold">{example.title}</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="rounded-lg bg-rose-50 p-3 text-rose-800">
                    Before: {example.before}
                  </p>
                  <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">
                    After: {example.after}
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
              Features
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Enough editing power for the job.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
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
            <h2 className="text-2xl font-semibold">
              Privacy and usage boundaries
            </h2>
          </div>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Uploaded images are used to process your removal job, not to train
            AI models. Guest images expire after 24 hours, free-user images
            after 7 days, and paid-user images after 30 days by default.
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h3 className="text-xl font-semibold text-amber-950">
            Not for watermark or logo removal
          </h3>
          <p className="mt-3 text-base leading-7 text-amber-900">
            AI Remover is for legitimate photo cleanup. Users must own or have
            permission to process uploaded images, and may not remove copyright
            watermarks, brand logos, or authorization marks.
          </p>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-950 text-white">
        <div className="container flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold">Need high-res downloads?</h2>
            <p className="mt-2 max-w-xl text-slate-300">
              Start free, then upgrade when you need more monthly processing,
              high-res results, and longer image retention.
            </p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
          >
            View pricing
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <section className="container py-12 lg:py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-normal text-teal-700 uppercase">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            Questions before you upload.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {faqs.map((item) => (
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
