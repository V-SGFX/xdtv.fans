import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // This box serves the live site from .next via `next start`. Setting
  // NEXT_DIST_DIR lets a verification build compile somewhere else instead of
  // overwriting the running build:
  //   NEXT_DIST_DIR=.next-verify npm run build
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '192.168.1.119',
        port: '4000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'xdtv.fans',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.7tv.app',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static-cdn.jtvnw.net',
        pathname: '/**',
      },
      // The content corpus resolves to exactly four image hosts (measured):
      // static-cdn.jtvnw.net (16.3k clips + 1.1k live), i.ytimg.com (363),
      // img.youtube.com (2) and www.dexerto.com (1466 articles). Listing them
      // lets the cards use optimised next/image instead of `unoptimized`.
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.dexerto.com',
        pathname: '/**',
      },
      // Kick stream thumbnails. Absent until now because the Kick sync was
      // hitting a Cloudflare-blocked endpoint and never produced any.
      // Źródła obrazków newsów. Scraper dokłada z czasem kolejne serwisy,
      // a obrazek z hosta spoza tej listy dostaje 400 z optymalizatora
      // Next.js i pokazuje się jako zepsuta kafelka. Dlatego oprócz tej
      // listy TileMedia ma zapasowe wyjście na wypadek nowego źródła.
      {
        protocol: 'https',
        hostname: 'cdn.mos.cms.futurecdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static0.polygonimages.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.kick.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'files.kick.com',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      // /explore used to bounce to Home; it now has a real destination.
      // /posts previously chained /posts -> /explore -> /, two hops.
      {
        source: '/explore',
        destination: '/discover',
        permanent: true,
      },
      {
        source: '/posts',
        destination: '/discover',
        permanent: true,
      },
      // A clip is a post; the detail view is /posts/:id. Was an app-dir
      // redirect stub, which is a rendered route for something the config
      // resolves in one hop.
      {
        source: '/clips/:id(\\d+)',
        destination: '/posts/:id',
        permanent: true,
      },
      // Duplicate news page — same API, same layout as /news.
      {
        source: '/wiadomosci',
        destination: '/news',
        permanent: true,
      },
      // NOTE: /streamers is deliberately NOT redirected. It is a real page with
      // its own metadata, is linked from nine places and carries SEO value; it
      // simply stops being top-level navigation and gains a Discover tab as a
      // second entry point.
      {
        source: '/chat',
        destination: '/community',
        permanent: true,
      },
      {
        source: '/c/:slug/post/:id',
        destination: '/posts/:id',
        permanent: true,
      },
      {
        source: '/c/:slug',
        destination: '/community?community=:slug',
        permanent: true,
      },
      {
        source: '/c',
        destination: '/community',
        permanent: true,
      },
      {
        source: '/community/:slug',
        destination: '/community?community=:slug',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'index, follow' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
