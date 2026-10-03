import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export const locales = ['pl', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'pl';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  // 1. Check cookie first (user's explicit choice)
  let locale: Locale = defaultLocale;
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    locale = cookieLocale as Locale;
  } else {
    // 2. Check Accept-Language header
    const acceptLang = headerStore.get('accept-language') || '';
    const preferred = acceptLang
      .split(',')
      .map((part) => {
        const [lang, q] = part.trim().split(';q=');
        return { lang: lang.trim().split('-')[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
      })
      .sort((a, b) => b.q - a.q);

    for (const { lang } of preferred) {
      if (locales.includes(lang as Locale)) {
        locale = lang as Locale;
        break;
      }
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
