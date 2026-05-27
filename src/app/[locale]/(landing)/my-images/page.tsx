import type { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readAnonymousSessionIdFromRequest } from '@/domains/remover/application/actor-session';
import { deleteRemoverJobImagesForUser } from '@/domains/remover/application/delete-image';
import { listMyRemoverJobsForActor } from '@/domains/remover/application/jobs';
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
import { RemoverDownloadButton } from '@/domains/remover/ui/remover-download-button';
import { resolveRemoverHomeCopy } from '@/domains/remover/ui/remover-home-copy';
import { buildRemoverHeaderFooter } from '@/domains/remover/ui/remover-shell';
import {
  readAuthUiRuntimeSettingsCached,
  readBillingRuntimeSettingsCached,
  readPublicUiConfigCached,
} from '@/domains/settings/application/settings-runtime.query';
import { getStorageService } from '@/infra/adapters/storage/service';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import { buildBrandPlaceholderValues } from '@/infra/platform/brand/placeholders.server';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildMetadataBaseUrl,
  isPublishedLocaleForPath,
} from '@/infra/url/canonical';
import { site, siteHomeContent } from '@/site';
import { ImageIcon, Lock, Trash2 } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import LandingMarketingLayout from '@/themes/default/layouts/landing-marketing';

type MyImagesCopy = {
  metadataTitle: string;
  metadataDescription: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  startButton: string;
  resultAlt: string;
  succeededTitle: string;
  jobTitle: string;
  statusLabel: string;
  createdLabel: string;
  expiresLabel: string;
  downloadLabel: string;
  deleteLabel: string;
  signInTitle: string;
  signInDescription: string;
  signInButton: string;
  createAccountButton: string;
  statuses: Record<string, string>;
};

function withLocale(path: string, locale: string): string {
  if (!locale || locale === 'en') {
    return path;
  }

  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

async function getMyImagesCopy(): Promise<MyImagesCopy> {
  const t = await getTranslations('common.my_images');

  return {
    metadataTitle: t('metadata_title'),
    metadataDescription: t('metadata_description'),
    title: t('title'),
    description: t('description'),
    emptyTitle: t('empty_title'),
    emptyDescription: t('empty_description'),
    startButton: t('start_button'),
    resultAlt: t('result_alt'),
    succeededTitle: t('succeeded_title'),
    jobTitle: t('job_title'),
    statusLabel: t('status_label'),
    createdLabel: t('created_label'),
    expiresLabel: t('expires_label'),
    downloadLabel: t('download_label'),
    deleteLabel: t('delete_label'),
    signInTitle: t('sign_in_title'),
    signInDescription: t('sign_in_description'),
    signInButton: t('sign_in_button'),
    createAccountButton: t('create_account_button'),
    statuses: t.raw('statuses') as Record<string, string>,
  };
}

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

  if (!isPublishedLocaleForPath('/my-images', locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const copy = await getMyImagesCopy();

  return {
    metadataBase: buildMetadataBaseUrl(),
    title: {
      absolute: copy.metadataTitle,
    },
    description: copy.metadataDescription,
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

  if (!isPublishedLocaleForPath('/my-images', locale)) {
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
  const copy = await getMyImagesCopy();
  const { header, footer } = buildRemoverHeaderFooter(
    brand,
    resolveRemoverHomeCopy(siteHomeContent, locale).shell
  );

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
                {copy.title}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                {copy.description}
              </p>
            </div>
          </div>
        </section>

        <section className="container py-12 lg:py-16">
          {!user ? (
            <SignInPrompt copy={copy} locale={locale} />
          ) : jobs.length === 0 ? (
            <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm md:p-8">
              <h2 className="text-2xl font-semibold">{copy.emptyTitle}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
                {copy.emptyDescription}
              </p>
              <Link
                href={withLocale('/', locale)}
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                {copy.startButton}
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
                          alt={copy.resultAlt}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-8" />
                      )}
                    </div>
                    <div>
                      <h2 className="font-semibold">
                        {job.status === 'succeeded'
                          ? copy.succeededTitle
                          : copy.jobTitle}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {copy.statusLabel}:{' '}
                        {copy.statuses[job.status] ?? job.status}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {copy.createdLabel}: {formatDate(job.createdAt, locale)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {copy.expiresLabel}: {formatDate(job.expiresAt, locale)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {job.outputImageKey ? (
                        <RemoverDownloadButton
                          jobId={job.id}
                          variant="high-res"
                          label={copy.downloadLabel}
                        />
                      ) : null}
                      <form action={deleteImageAction.bind(null, job.id)}>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                        >
                          <Trash2 className="size-4" />
                          {copy.deleteLabel}
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

function SignInPrompt({
  copy,
  locale,
}: {
  copy: MyImagesCopy;
  locale: string;
}) {
  const myImagesPath = withLocale('/my-images', locale);
  const signInHref = `${withLocale('/sign-in', locale)}?callbackUrl=${encodeURIComponent(myImagesPath)}`;
  const signUpHref = `${withLocale('/sign-up', locale)}?callbackUrl=${encodeURIComponent(myImagesPath)}`;

  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm md:p-8">
      <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        <Lock className="size-6" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold">{copy.signInTitle}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
        {copy.signInDescription}
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href={signInHref}
          className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {copy.signInButton}
        </Link>
        <Link
          href={signUpHref}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-5 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
        >
          {copy.createAccountButton}
        </Link>
      </div>
    </div>
  );
}

function formatDate(value: Date | string | null, locale: string): string {
  if (!value) {
    return '-';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString(locale || 'en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
