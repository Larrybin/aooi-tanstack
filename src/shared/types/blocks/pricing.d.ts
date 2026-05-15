import type { Button } from '@/types/blocks/base/button';
import type {
  FAQ as FAQType,
  Testimonials as TestimonialsType,
} from '@/shared/types/blocks/landing';

type PaymentInterval = 'one-time' | 'day' | 'week' | 'month' | 'year';
type PricingEntitlements = Record<string, string | number | boolean>;

export interface PricingGroup {
  name?: string;
  title?: string;
  description?: string;
  label?: string;
  is_featured?: boolean;
}

export interface PricingCurrency {
  currency: string; // currency code
  amount: number; // price amount
  price: string; // price text
  original_price: string; // original price text
  payment_product_id?: string;
}

export interface PricingItem {
  title?: string;
  description?: string;
  label?: string;

  currency: string; // default currency
  amount: number; // default price amount
  price?: string; // default price text
  original_price?: string; // default original price text
  currencies?: readonly PricingCurrency[]; // alternative currencies with different prices

  unit?: string;
  features_title?: string;
  features?: readonly string[];
  button?: Button;
  tip?: string;
  is_featured?: boolean;
  interval: PaymentInterval;
  product_id: string;
  payment_product_id?: string;
  product_name?: string;
  plan_name?: string;
  checkout_enabled?: boolean;
  entitlements?: PricingEntitlements;

  credits?: number;
  valid_days?: number;
  group?: string;
}

export interface Pricing {
  id?: string;
  disabled?: boolean;
  name?: string;
  title?: string;
  description?: string;
  items?: readonly PricingItem[];
  groups?: readonly PricingGroup[];
  className?: string;
  sr_only_title?: string;
}

export interface SitePricing {
  metadata?: {
    title?: string;
    description?: string;
  };
  pricing: Pricing;
  faq?: FAQType;
  testimonials?: TestimonialsType;
}
