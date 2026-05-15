import type { Metadata } from 'next';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { ImageIcon, Lock, Trash2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { listMyRemoverJobsForActor } from '@/domains/remover/application/jobs';
import { deleteRemoverJobImagesForUser } from '@/domains/remover/application/delete-image';
import { readAnonymousSessionIdFromRequest } from '@/domains/remover/application/actor-session';
import { RemoverDownloadButton } from '@/domains/remover/ui/remover-download-button';
import { buildRemoverHeaderFooter } from '@/domains/remover/ui/remover-shell';
import {
  claimRemoverImageAssetsByKeys,
  markRemoverImageAssetsDeletedByKeys,
} from '@/domains/remover/infra/image-asset';
import {
  claimRemoverJobById,
  findRemoverJobById,
  listRemoverJobsForOwner,
  markRemoverJobDeletedById,
} from '@/domains/remover/infra/job';
import { claimRemoverQuotaReservationById } from '@/domains/remover/infra/quota-reservation';
import {
  readAuthUiRuntimeSettingsCached,
  readBillingRuntimeSettingsCached,
  readPublicUiConfigCached,
} from '@/domains/settings/application/settings-runtime.query';
import { getStorageService } from '@/infra/adapters/storage/service';
import { buildBrandPlaceholderValues } from '@/infra/platform/brand/placeholders.server';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildMetadataBaseUrl,
} from '@/infra/url/canonical';
import { site } from '@/site';
import { setRequestLocale } from 'next-intl/server';

import LandingMarketingLayout from '@/themes/default/layouts/landing-marketing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const siteKey: string = site.key;

  if (siteKey !== 'ai-remover') {
    return {};
  }

  return {
    metadataBase: buildMetadataBaseUrl(),
    title: {
      absolute: 'My Images - AI Remover',
    },
    description: 'View and manage your recent AI Remover image results.',
    alternates: {
      canonical: buildCanonicalUrl('/my-images', locale),
      languages: buildLanguageAlternates('/my-images'),
    },
  };
}

async function deleteImageAction(jobId: string) {
  'use server';

  const user = await getSignedInUserIdentity();
  if (!user) {
    return;
  }

  await deleteRemoverJobImagesForUser({
    jobId,
    userId: user.id,
    deps: {
      findJobById: findRemoverJobById,
      getStorageService,
      markJobDeleted: markRemoverJobDeletedById,
      markAssetsDeleted: markRemoverImageAssetsDeletedByKeys,
    },
  });
  revalidatePath('/my-images');
}

async function resolveMyImagesActor(userId: string) {
  const requestHeaders = await headers();
  const secret =
    getRuntimeEnvString('BETTER_AUTH_SECRET')?.trim() ||
    getRuntimeEnvString('AUTH_SECRET')?.trim() ||
    '';
  const anonymousSessionId = await readAnonymousSessionIdFromRequest(
    new Request('https://ai-remover.local/my-images', {
      headers: new Headers(requestHeaders),
    }),
    { secret }
  );

  return {
    kind: 'user' as const,
    userId,
    anonymousSessionId,
    productId: 'free',
  };
}

export default async function MyImagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const siteKey: string = site.key;

  if (siteKey !== 'ai-remover') {
    notFound();
  }

  const [publicUiConfig, authSettings, billingSettings, user] =
    await Promise.all([
      readPublicUiConfigCached(),
      readAuthUiRuntimeSettingsCached(),
      readBillingRuntimeSettingsCached(),
      getSignedInUserIdentity(),
    ]);
  const brand = buildBrandPlaceholderValues();
  const { header, footer } = buildRemoverHeaderFooter(brand);

  const jobs = user
    ? await listMyRemoverJobsForActor({
        actor: await resolveMyImagesActor(user.id),
        limit: 30,
        deps: {
          listJobsForOwner: listRemoverJobsForOwner,
          claimJobById: claimRemoverJobById,
          claimAssetsByKeys: claimRemoverImageAssetsByKeys,
          claimReservationById: claimRemoverQuotaReservationById,
        },
      })
    : [];
  return (
    <LandingMarketingLayout
      header={header}
      footer={footer}
      locale={locale}
      publicUiConfig={publicUiConfig}
      authSettings={authSettings}
      billingSettings={billingSettings}
    >
      <div className="bg-[#f7faf8] text-slate-950">
        <section className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f7faf8)]">
          <div className="container py-14 md:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <ImageIcon className="size-7" />
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-normal md:text-5xl">
                My Images
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                View, download, and delete your recent AI Remover results.
              </p>
            </div>
          </div>
        </section>

        <section className="container py-12 lg:py-16">
          {!user ? (
            <SignInPrompt />
          ) : jobs.length === 0 ? (
            <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm md:p-8">
              <h2 className="text-2xl font-semibold">No images yet</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Process an image from the homepage and your recent results will
                appear here.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Start removing objects
              </Link>
            </div>
          ) : (
            <div className="mx-auto grid max-w-5xl gap-4">
              {jobs.map((job) => {
                const previewUrl = job.outputImageKey
                  ? `/api/remover/download/low-res?jobId=${encodeURIComponent(job.id)}`
                  : '';

                return (
                  <article
                    key={job.id}
                    className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[160px_minmax(0,1fr)_auto] md:items-center"
                  >
                    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
                      {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt="AI Remover result"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-8" />
                      )}
                    </div>
                    <div>
                      <h2 className="font-semibold">
                        {job.status === 'succeeded'
                          ? 'Cleaned image'
                          : 'Removal job'}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Status: {job.status}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Created: {formatDate(job.createdAt)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Expires: {formatDate(job.expiresAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {job.outputImageKey ? (
                        <RemoverDownloadButton
                          jobId={job.id}
                          variant="high-res"
                          label="Download"
                        />
                      ) : null}
                      <form action={deleteImageAction.bind(null, job.id)}>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </LandingMarketingLayout>
  );
}

function SignInPrompt() {
  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm md:p-8">
      <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        <Lock className="size-6" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold">
        Image history requires sign-in
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
        Guest results are temporary. Create an account or sign in to keep a
        7-day free history, or upgrade for 30-day retention.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/sign-in?callbackUrl=/my-images"
          className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up?callbackUrl=/my-images"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-5 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}

function formatDate(value: Date | string | null): string {
  if (!value) {
    return '-';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
