import { pl, enUS, type Locale } from 'date-fns/locale';

const localeMap: Record<string, Locale> = {
  pl,
  en: enUS,
};

export function getDateLocale(locale: string): Locale {
  return localeMap[locale] || enUS;
}

export function getNumberLocale(locale: string): string {
  return locale === 'pl' ? 'pl-PL' : 'en-US';
}
