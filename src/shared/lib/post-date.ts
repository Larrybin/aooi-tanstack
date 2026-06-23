function getUtcParts(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    date,
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
}

export function formatPostDateForLocale(createdAt: string, locale?: string) {
  const parts = getUtcParts(createdAt);
  if (!parts) {
    return 'Invalid date';
  }

  if (locale === 'zh') {
    return `${parts.year}/${String(parts.month).padStart(2, '0')}/${String(
      parts.day
    ).padStart(2, '0')}`;
  }

  const month = new Intl.DateTimeFormat(locale || 'en', {
    month: 'short',
    timeZone: 'UTC',
  }).format(parts.date);

  return `${month} ${parts.day}, ${parts.year}`;
}

export function formatPostDate(createdAt: string, locale?: string) {
  return formatPostDateForLocale(createdAt, locale);
}
