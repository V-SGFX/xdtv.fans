import type { Metadata } from "next";
import { Inter, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getLocale, getMessages, getTranslations } from 'next-intl/server';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://xdtv.fans'),
  title: {
    default: 'XDTV - Streamerzy, dramy, klipy i społeczność na żywo',
    template: '%s | XDTV',
  },
  description: 'XDTV to centrum streamingu: profile streamerów, najgłośniejsze dramy, viralowe klipy, gorące dyskusje i community live.',
  keywords: [
    'streamerzy',
    'drama streamerów',
    'klipy ze streamów',
    'twitch polska',
    'kick polska',
    'youtube live',
    'społeczność gamingowa',
    'xdtv',
  ],
  applicationName: 'XDTV',
  authors: [{ name: 'XDTV' }],
  publisher: 'XDTV',
  category: 'entertainment',
  openGraph: {
    type: 'website',
    locale: 'pl_PL',
    url: 'https://xdtv.fans',
    siteName: 'XDTV',
    title: 'XDTV - Streamerzy, dramy, klipy i społeczność na żywo',
    description: 'Sprawdzaj najgorętsze dramy, klipy i dyskusje streamerów w jednym feedzie.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'XDTV - streamerzy, klipy, community',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'XDTV - Streamerzy, dramy, klipy i społeczność na żywo',
    description: 'Najgorętsze dramy i klipy streamerów. Wejdź do dyskusji na żywo.',
    images: ['/opengraph-image'],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-video-preview': -1,
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://xdtv.fans',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://xdtv.fans/#organization',
      name: 'XDTV',
      url: 'https://xdtv.fans',
      logo: 'https://xdtv.fans/opengraph-image',
      sameAs: [
        'https://xdtv.fans/discover?tab=streamers',
        'https://xdtv.fans/community',
        'https://xdtv.fans/clips',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://xdtv.fans/#website',
      name: 'XDTV',
      url: 'https://xdtv.fans',
      inLanguage: 'pl-PL',
      publisher: { '@id': 'https://xdtv.fans/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://xdtv.fans/search?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/*
        Nie ma tu skryptu ustawiającego motyw.

        Stał w <head>, blokował pierwsze malowanie przy KAŻDYM wejściu
        i czytał `xdtv_theme` z magazynu lokalnego — po to, żeby ustawić
        atrybut `data-theme`, na który NIC w arkuszu stylów nie reagowało
        (sprawdzone: zero reguł). Serwis ma jeden motyw, ciemny. Skrypt,
        kontekst motywu i dostawca wyleciały razem, bo żaden komponent
        nie wywoływał `useTheme()` ani razu.
      */}
      <body className="min-h-full bg-dark-950 text-text-primary">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers locale={locale} messages={messages as Record<string, unknown>}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
