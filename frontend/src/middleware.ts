import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const locales = ['pl', 'en'] as const;
const defaultLocale = 'pl';

// Polish-speaking countries
const PL_COUNTRIES = new Set(['PL']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes, static files, etc.
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next();
  }

  // Check if user already has a locale cookie
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return NextResponse.next();
  }

  // Determine locale from geo (Cloudflare header) or Accept-Language
  let detectedLocale = defaultLocale;

  // 1. Try geo-based detection (Cloudflare / Vercel)
  const country =
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-vercel-ip-country') ||
    '';

  if (country && !PL_COUNTRIES.has(country.toUpperCase())) {
    detectedLocale = 'en';
  } else if (!country) {
    // 2. Fallback to Accept-Language
    const acceptLang = request.headers.get('accept-language') || '';
    const preferred = acceptLang
      .split(',')
      .map((part) => {
        const [lang, q] = part.trim().split(';q=');
        return { lang: lang.trim().split('-')[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
      })
      .sort((a, b) => b.q - a.q);

    for (const { lang } of preferred) {
      if ((locales as readonly string[]).includes(lang)) {
        detectedLocale = lang;
        break;
      }
    }
  }

  // Set the locale cookie so it persists
  const response = NextResponse.next();
  response.cookies.set('NEXT_LOCALE', detectedLocale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  });

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|uploads|.*\\..*).*)'],
};
