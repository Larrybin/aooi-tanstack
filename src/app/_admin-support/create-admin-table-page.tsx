import 'server-only';

import { requirePagePermission } from '@/app/[locale]/(admin)/_guards/page-access';
import type { PermissionCode } from '@/app/access-control/action-guard';
import {
  buildAdminQueryUrl,
  isAdminTabActive,
  normalizeAdminSearchParams,
} from '@/surfaces/admin/server/create-admin-table-page.helpers';
import {
  buildAdminCrumbs,
  type CrumbSegment,
} from '@/surfaces/admin/server/crumbs';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { z } from 'zod';

import { TableCard } from '@/shared/blocks/table';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
import type { Button, Filter, Search, Tab } from '@/shared/types/blocks/common';
import type { Table, TableColumn } from '@/shared/types/blocks/table';

type TranslationFunction = Awaited<ReturnType<typeof getTranslations>>;
type SearchParamInput = Record<
  string,
  string | string[] | number | boolean | null | undefined
>;

type AdminTabConfig<TQuery extends Record<string, unknown>> = {
  name: string;
  titleKey: string;
  queryPatch?: Partial<TQuery>;
};

type AdminFilterConfig<TQuery extends Record<string, unknown>> = {
  name: keyof TQuery & string;
  titleKey: string;
  options: Array<{
    labelKey: string;
    value?: string;
  }>;
};

type AdminSearchConfig<TQuery extends Record<string, unknown>> = {
  name: keyof TQuery & string;
  titleKey: string;
  placeholderKey: string;
};

type AdminTablePageConfig<
  TRow extends object,
  TQuery extends Record<string, unknown>,
> = {
  namespace: string;
  permission: PermissionCode;
  beforeLoad?: (args: { locale: string }) => Promise<void> | void;
  crumbs: CrumbSegment[];
  tabs?: Array<AdminTabConfig<TQuery>>;
  filters?: Array<AdminFilterConfig<TQuery>>;
  search?: AdminSearchConfig<TQuery>;
  actions?:
    | Button[]
    | ((args: { t: TranslationFunction; query: TQuery }) => Button[]);
  query: {
    schema: z.ZodType<TQuery>;
    load: (query: TQuery) => Promise<{
      rows: TRow[];
      total?: number;
    }>;
  };
  columns: (args: {
    t: TranslationFunction;
    query: TQuery;
  }) => TableColumn<TRow>[];
};

function getTabMatchKeys<TQuery extends Record<string, unknown>>(
  tabs: Array<AdminTabConfig<TQuery>>
) {
  return Array.from(
    new Set(
      tabs.flatMap(
        (tab) =>
          Object.keys(tab.queryPatch ?? {}) as Array<keyof TQuery & string>
      )
    )
  );
}

export function createAdminTablePage<
  TRow extends object,
  TQuery extends Record<string, unknown>,
>(config: AdminTablePageConfig<TRow, TQuery>) {
  return async function AdminTablePage({
    params,
    searchParams,
  }: {
    params: Promise<{ locale: string }>;
    searchParams?: Promise<SearchParamInput>;
  }) {
    const { locale } = await params;
    setRequestLocale(locale);

    await config.beforeLoad?.({ locale });

    await requirePagePermission({
      code: config.permission,
      redirectUrl: '/admin/no-permission',
      locale,
    });

    const t = await getTranslations(config.namespace);
    const rawSearchParams = normalizeAdminSearchParams(await searchParams);
    const query = config.query.schema.parse(rawSearchParams);
    const data = await config.query.load(query);
    const tabMatchKeys = config.tabs ? getTabMatchKeys(config.tabs) : [];

    const tabs: Tab[] | undefined = config.tabs?.map((tab) => ({
      name: tab.name,
      title: t(tab.titleKey),
      url: buildAdminQueryUrl(
        rawSearchParams,
        tab.queryPatch as Record<string, unknown> | undefined,
        tabMatchKeys
      ),
      is_active: isAdminTabActive(query, config.tabs ?? [], tab),
    }));

    const filters: Filter[] | undefined = config.filters?.map((filter) => ({
      name: filter.name,
      title: t(filter.titleKey),
      value:
        typeof query[filter.name] === 'string'
          ? (query[filter.name] as string)
          : undefined,
      options: filter.options.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    }));

    const search: Search | undefined = config.search
      ? {
          name: config.search.name,
          title: t(config.search.titleKey),
          placeholder: t(config.search.placeholderKey),
          value:
            typeof query[config.search.name] === 'string'
              ? (query[config.search.name] as string)
              : undefined,
        }
      : undefined;

    const actions =
      typeof config.actions === 'function'
        ? config.actions({ t, query })
        : config.actions;

    const table: Table<TRow> = {
      columns: config.columns({ t, query }),
      data: data.rows,
      ...(typeof data.total === 'number' &&
      typeof query.page === 'number' &&
      typeof query.pageSize === 'number'
        ? {
            pagination: {
              total: data.total,
              page: query.page,
              limit: query.pageSize,
            },
          }
        : {}),
    };

    return (
      <>
        <Header crumbs={buildAdminCrumbs(t, config.crumbs)} />
        <Main>
          <MainHeader
            title={t('list.title')}
            tabs={tabs}
            filters={filters}
            search={search}
            actions={actions}
          />
          <TableCard table={table} />
        </Main>
      </>
    );
  };
}
