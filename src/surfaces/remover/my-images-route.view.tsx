import { RemoverDownloadButton } from '@/domains/remover/ui/remover-download-button';
import { RemoverRemoveButton } from '@/domains/remover/ui/remover-remove-button';
import { ImageIcon, Lock } from 'lucide-react';

import type { MyImagesRouteData } from '@/server/remover/my-images-route-data';

function localize(path: string, locale: string) {
  return locale === 'en' ? path : `/${locale}${path === '/' ? '' : path}`;
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleDateString(locale || 'en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
}

export function MyImagesRouteView({ data }: { data: MyImagesRouteData }) {
  const myImagesPath = localize('/my-images', data.locale);
  if (!data.signedIn) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Lock className="size-6" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold">Sign in to view your images</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
          Your saved AI Remover jobs, previews, and downloads are available after sign-in.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <a className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white" href={`${localize('/sign-in', data.locale)}?callbackUrl=${encodeURIComponent(myImagesPath)}`}>
            Sign in
          </a>
          <a className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-medium text-slate-800" href={`${localize('/sign-up', data.locale)}?callbackUrl=${encodeURIComponent(myImagesPath)}`}>
            Create account
          </a>
        </div>
      </main>
    );
  }
  return (
    <main className="bg-[#f7faf8] text-slate-950">
      <section className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f7faf8)]">
        <div className="container py-14 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <ImageIcon className="size-7" />
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-normal md:text-5xl">My Images</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Review saved AI Remover jobs and download finished images.
            </p>
          </div>
        </div>
      </section>
      <section className="container py-12 lg:py-16">
        {data.jobs.length === 0 ? (
          <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm md:p-8">
            <h2 className="text-2xl font-semibold">No saved images yet</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Remove a background first, then return here to find your saved jobs.
            </p>
            <a href={localize('/', data.locale)} className="mt-6 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white">
              Start removing backgrounds
            </a>
          </div>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-4">
            {data.jobs.map((job) => (
              <article key={job.id} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[160px_minmax(0,1fr)_auto] md:items-center">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
                  {job.previewUrl ? <img src={job.previewUrl} alt="AI Remover result" className="h-full w-full object-cover" /> : <ImageIcon className="size-8" />}
                </div>
                <div>
                  <h2 className="font-semibold">{job.hasOutput ? 'Completed image' : 'Image job'}</h2>
                  <p className="mt-1 text-sm text-slate-600">Status: {job.status}</p>
                  <p className="mt-1 text-sm text-slate-600">Created: {formatDate(job.createdAt, data.locale)}</p>
                  <p className="mt-1 text-sm text-slate-600">Expires: {formatDate(job.expiresAt, data.locale)}</p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {job.hasOutput ? <RemoverDownloadButton jobId={job.id} variant="high-res" label="Download" /> : null}
                  <RemoverRemoveButton jobId={job.id} label="Delete" />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
