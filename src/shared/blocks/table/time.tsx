import { useLocale } from '@/shared/lib/i18n/native';

import {
  formatDatePattern,
  formatRelativeTime,
} from '@/shared/lib/date/format';

export function Time({
  value,
  placeholder,
  metadata,
  className,
}: {
  value: string | Date;
  placeholder?: string;
  metadata?: {
    format?: string;
  };
  className?: string;
}) {
  const intlLocale = useLocale();
  const locale = intlLocale === 'zh' ? 'zh-cn' : intlLocale;

  if (!value) {
    if (placeholder) {
      return <div className={className}>{placeholder}</div>;
    }

    return null;
  }

  const formatted = metadata?.format
    ? formatDatePattern(value, metadata.format)
    : formatRelativeTime(value, { locale });

  return <div className={className}>{formatted || placeholder || null}</div>;
}
