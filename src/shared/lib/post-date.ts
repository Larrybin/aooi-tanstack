import moment from 'moment';

export function formatPostDateForLocale(createdAt: string, locale?: string) {
  return moment(createdAt)
    .locale(locale || 'en')
    .format(locale === 'zh' ? 'YYYY/MM/DD' : 'MMM D, YYYY');
}

export function formatPostDate(createdAt: string, locale?: string) {
  return formatPostDateForLocale(createdAt, locale);
}
