'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { usePublicAppContext } from '@/shared/contexts/app';
import {
  resolveSelfUserDetailsForAction,
  useSelfUserDetails,
} from '@/shared/hooks/use-self-user-details';
import { isPlainObject } from '@/shared/lib/api/client';
import { fetchJson, toastFetchError } from '@/shared/lib/api/fetch-json';
import {
  formatMessageWithRequestId,
  getRequestIdFromError,
  RequestIdError,
} from '@/shared/lib/api/request-id';
import { cn } from '@/shared/lib/utils';
import type { SelfUserDetails } from '@/shared/types/auth-session';
import type {
  PricingCurrency,
  PricingItem,
  Pricing as PricingType,
} from '@/shared/types/blocks/pricing';

function getCurrenciesFromItem(item: PricingItem | null): PricingCurrency[] {
  if (!item) return [];

  const defaultCurrency: PricingCurrency = {
    currency: item.currency,
    amount: item.amount,
    price: item.price || '',
    original_price: item.original_price || '',
  };

  return item.currencies?.length
    ? [defaultCurrency, ...item.currencies]
    : [defaultCurrency];
}

function getInitialCurrency(
  currencies: PricingCurrency[],
  locale: string,
  defaultCurrency: string
): string {
  if (!currencies.length || locale !== 'zh') return defaultCurrency;
  return (
    currencies.find((c) => c.currency.toLowerCase() === 'cny')?.currency ??
    defaultCurrency
  );
}

function isCheckoutEnabled(item: PricingItem): boolean {
  return item.checkout_enabled !== false && item.amount > 0;
}

export function Pricing({
  pricing,
  className,
}: {
  pricing: PricingType;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations('pricing.page');
  const { setIsShowSignModal } = usePublicAppContext();
  const {
    data: details,
    error: detailsError,
    isLoading: isLoadingDetails,
    refresh: refreshDetails,
  } = useSelfUserDetails();
  const currentSubscriptionProductId =
    details?.currentSubscriptionProductId ?? null;
  const pricingAccountErrorMessage = useMemo(() => {
    if (!detailsError) {
      return null;
    }

    return formatMessageWithRequestId(
      'Failed to load pricing account details',
      getRequestIdFromError(detailsError)
    );
  }, [detailsError]);

  const [group, setGroup] = useState(() => {
    // First look for a group with is_featured set to true
    const featuredGroup = pricing.groups?.find((g) => g.is_featured);
    // If no featured group exists, fall back to the first group
    return featuredGroup?.name || pricing.groups?.[0]?.name;
  });

  useEffect(() => {
    if (!currentSubscriptionProductId) {
      return;
    }

    const currentItem = pricing.items?.find(
      (item) => item.product_id === currentSubscriptionProductId
    );

    if (currentItem?.group) {
      setGroup(currentItem.group);
    }
  }, [currentSubscriptionProductId, pricing.items]);

  const [isLoading, setIsLoading] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);

  const [selectedCurrencies, setSelectedCurrencies] = useState<
    Record<string, string>
  >({});

  const itemCurrencies = useMemo(() => {
    const result: Record<
      string,
      { selectedCurrency: string; displayedItem: PricingItem }
    > = {};
    if (!pricing.items || pricing.items.length === 0) return result;

    for (const item of pricing.items) {
      const currencies = getCurrenciesFromItem(item);
      const selectedCurrency =
        selectedCurrencies[item.product_id] ||
        getInitialCurrency(currencies, locale, item.currency);

      const currencyData = currencies.find(
        (c) => c.currency.toLowerCase() === selectedCurrency.toLowerCase()
      );

      const displayedItem = currencyData
        ? {
            ...item,
            currency: currencyData.currency,
            amount: currencyData.amount,
            price: currencyData.price,
            original_price: currencyData.original_price,
            payment_product_id:
              currencyData.payment_product_id || item.payment_product_id,
          }
        : item;

      result[item.product_id] = { selectedCurrency, displayedItem };
    }

    return result;
  }, [pricing.items, locale, selectedCurrencies]);

  // Handler for currency change
  const handleCurrencyChange = (productId: string, currency: string) => {
    setSelectedCurrencies((prev) => ({ ...prev, [productId]: currency }));
  };

  const resolveDetailsForPayment = useCallback(async () => {
    const result = await resolveSelfUserDetailsForAction({
      currentDetails: details,
      loadDetails: refreshDetails,
    });

    if (result.status === 'auth_required') {
      setIsShowSignModal(true);
      return null;
    }

    if (result.status === 'error') {
      toastFetchError(result.error, 'Failed to load pricing account details');
      return null;
    }

    return result.details;
  }, [details, refreshDetails, setIsShowSignModal]);

  const handlePayment = async (item: PricingItem) => {
    setProductId(item.product_id);
    const accountDetails = await resolveDetailsForPayment();
    if (!accountDetails) {
      setProductId(null);
      return;
    }

    // Use displayed item with selected currency
    const displayedItem =
      itemCurrencies[item.product_id]?.displayedItem || item;

    if (
      accountDetails.currentSubscriptionProductId === displayedItem.product_id
    ) {
      setProductId(null);
      return;
    }

    void handleCheckout(displayedItem, accountDetails);
  };

  const handleCheckout = async (
    item: PricingItem,
    accountDetails?: SelfUserDetails
  ) => {
    try {
      const resolvedDetails =
        accountDetails ?? (await resolveDetailsForPayment());
      if (!resolvedDetails) {
        return;
      }

      if (resolvedDetails.currentSubscriptionProductId === item.product_id) {
        return;
      }

      const params = {
        product_id: item.product_id,
        currency: item.currency,
        locale: locale || 'en',
      };

      setIsLoading(true);
      setProductId(item.product_id);

      const data = await fetchJson<{ checkoutUrl: string }>(
        '/api/payment/checkout',
        { method: 'POST', body: params },
        {
          validate: (value): value is { checkoutUrl: string } =>
            isPlainObject(value) &&
            typeof (value as { checkoutUrl?: unknown }).checkoutUrl ===
              'string' &&
            Boolean((value as { checkoutUrl: string }).checkoutUrl.trim()),
          invalidDataMessage: 'invalid checkout response',
        }
      );

      const checkoutUrl = data.checkoutUrl.trim();
      window.location.assign(checkoutUrl);
    } catch (e: unknown) {
      if (e instanceof RequestIdError && e.status === 401) {
        setIsLoading(false);
        setProductId(null);
        setIsShowSignModal(true);
        return;
      }

      toastFetchError(e, t('checkout_failed'));

      setIsLoading(false);
      setProductId(null);
    }
  };

  return (
    <section
      id={pricing.id}
      className={cn(
        'relative overflow-hidden py-18 md:py-24',
        pricing.className,
        className
      )}
    >
      <div
        aria-hidden
        className="from-primary/10 absolute inset-x-0 top-0 h-64 bg-gradient-to-b via-transparent to-transparent"
      />
      <div
        aria-hidden
        className="bg-primary/8 absolute top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
      />

      <div className="relative mx-auto mb-12 max-w-3xl px-4 text-center md:px-8">
        {pricing.sr_only_title && (
          <h1 className="sr-only">{pricing.sr_only_title}</h1>
        )}
        <p className="text-primary mb-4 text-xs font-semibold tracking-[0.24em] uppercase">
          Choose your plan
        </p>
        <h2 className="mb-4 text-3xl font-semibold tracking-tight text-balance lg:text-5xl">
          {pricing.title}
        </h2>
        <p className="text-muted-foreground mx-auto max-w-2xl text-base leading-7 lg:text-lg">
          {pricing.description}
        </p>
      </div>

      <div className="relative container max-w-6xl">
        {pricingAccountErrorMessage && (
          <div className="border-destructive/30 bg-destructive/5 text-destructive mb-8 rounded-2xl border px-4 py-3 text-sm">
            {pricingAccountErrorMessage}
          </div>
        )}

        {pricing.groups && pricing.groups.length > 0 && (
          <div className="mx-auto mt-8 mb-10 flex w-full flex-col items-center gap-4 md:max-w-2xl">
            <Tabs value={group} onValueChange={setGroup} className="">
              <TabsList className="border-border/80 bg-background/90 h-auto rounded-full border p-1.5 shadow-sm backdrop-blur">
                {pricing.groups.map((item, i) => {
                  return (
                    <TabsTrigger
                      key={i}
                      value={item.name || ''}
                      className="rounded-full px-4 py-2.5 text-sm font-medium"
                    >
                      {item.title}
                      {item.label && (
                        <Badge className="bg-primary/10 text-primary ml-2 rounded-full shadow-none">
                          {item.label}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
            <p className="text-muted-foreground text-center text-sm leading-6">
              Every plan starts with the same product shell, auth, billing,
              credits, and docs. You are choosing how much leverage you want up
              front.
            </p>
          </div>
        )}

        <div
          className={`mt-0 grid w-full items-stretch gap-6 md:grid-cols-${
            pricing.items?.filter((item) => !item.group || item.group === group)
              ?.length
          }`}
        >
          {pricing.items?.map((item: PricingItem, idx) => {
            if (item.group && item.group !== group) {
              return null;
            }

            let isCurrentPlan = false;
            if (
              currentSubscriptionProductId &&
              currentSubscriptionProductId === item.product_id
            ) {
              isCurrentPlan = true;
            }

            // Get currency state for this item
            const currencyState = itemCurrencies[item.product_id];
            const displayedItem = currencyState?.displayedItem || item;
            const selectedCurrency =
              currencyState?.selectedCurrency || item.currency;
            const currencies = getCurrenciesFromItem(item);

            return (
              <Card
                key={idx}
                className={cn(
                  'border-border/80 bg-card/96 relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border shadow-sm backdrop-blur',
                  item.is_featured &&
                    'border-primary/35 shadow-primary/10 shadow-xl md:-translate-y-2'
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    'from-primary/0 via-primary/20 to-primary/0 absolute inset-x-6 top-0 h-px bg-gradient-to-r',
                    item.is_featured &&
                      'from-primary/35 via-primary to-primary/35 inset-x-0 h-1'
                  )}
                />
                {item.label && (
                  <span className="bg-primary/10 text-primary absolute top-4 right-4 flex h-7 items-center rounded-full px-3 text-xs font-semibold">
                    {item.label}
                  </span>
                )}

                <CardHeader className="space-y-5 p-7 pb-6">
                  <div className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
                    {item.is_featured ? 'Best value' : 'Plan'}
                  </div>
                  <CardTitle className="font-medium">
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                  </CardTitle>

                  <div className="flex flex-wrap items-center gap-2">
                    {displayedItem.original_price && (
                      <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs line-through">
                        {displayedItem.original_price}
                      </span>
                    )}
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="block text-4xl font-semibold tracking-tight">
                      <span className="text-primary">
                        {displayedItem.price}
                      </span>{' '}
                      {displayedItem.unit ? (
                        <span className="text-muted-foreground text-sm font-normal">
                          {displayedItem.unit}
                        </span>
                      ) : (
                        ''
                      )}
                    </div>

                    {currencies.length > 1 && (
                      <Select
                        value={selectedCurrency}
                        onValueChange={(currency) =>
                          handleCurrencyChange(item.product_id, currency)
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className="border-muted-foreground/30 bg-background/50 h-6 min-w-[60px] px-2 text-xs"
                        >
                          <SelectValue
                            placeholder={t('currency_placeholder')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((currency) => (
                            <SelectItem
                              key={currency.currency}
                              value={currency.currency}
                              className="text-xs"
                            >
                              {currency.currency.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <CardDescription className="min-h-[2.75rem] text-sm leading-6">
                    {item.description}
                  </CardDescription>
                  {item.tip && (
                    <span className="text-muted-foreground min-h-[3rem] text-sm leading-6">
                      {item.tip}
                    </span>
                  )}

                  {isCurrentPlan ? (
                    <Button
                      variant="outline"
                      className="mt-2 h-11 w-full rounded-full px-4 py-2"
                      disabled
                    >
                      <span className="hidden text-sm md:block">
                        {t('current_plan')}
                      </span>
                    </Button>
                  ) : !isCheckoutEnabled(item) && item.button?.url ? (
                    <Button
                      asChild
                      variant="outline"
                      className="mt-2 h-11 w-full rounded-full px-4 py-2"
                    >
                      <Link href={item.button.url}>
                        {item.button?.icon && (
                          <SmartIcon
                            name={item.button?.icon as string}
                            className="size-4"
                          />
                        )}
                        <span className="block">{item.button?.title}</span>
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handlePayment(item)}
                      disabled={isLoading || isLoadingDetails}
                      className={cn(
                        'focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
                        'mt-2 h-11 w-full px-4 py-2',
                        'bg-primary text-primary-foreground hover:bg-primary/90 border-[0.5px] border-white/25 shadow-md shadow-black/20'
                      )}
                    >
                      {(isLoading && item.product_id === productId) ||
                      (isLoadingDetails && item.product_id === productId) ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span className="block">{t('processing')}</span>
                        </>
                      ) : (
                        <>
                          {item.button?.icon && (
                            <SmartIcon
                              name={item.button?.icon as string}
                              className="size-4"
                            />
                          )}
                          <span className="block">{item.button?.title}</span>
                        </>
                      )}
                    </Button>
                  )}
                </CardHeader>

                <CardContent className="flex flex-1 flex-col space-y-4 px-7 pb-7">
                  <hr className="border-border/70" />

                  {item.features_title && (
                    <p className="text-sm font-semibold">
                      {item.features_title}
                    </p>
                  )}
                  <ul className="list-outside space-y-3 text-sm leading-6">
                    {item.features?.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="text-primary mt-1 size-3.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

    </section>
  );
}
