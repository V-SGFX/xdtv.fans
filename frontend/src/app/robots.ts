import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/admin-panel/', '/settings/', '/profile/', '/notifications/', '/dashboard/', '/auth/'],
      },
      {
        userAgent: [
          'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
          'CCBot', 'anthropic-ai', 'ClaudeBot', 'Claude-Web',
          'Google-Extended',
          'Bytespider', 'Amazonbot',
          'FacebookBot', 'Meta-ExternalAgent',
          'cohere-ai', 'PerplexityBot',
          'YouBot', 'Diffbot',
          'Applebot-Extended',
          'AI2Bot', 'Ai2Bot-Dolma',
          'Scrapy', 'img2dataset',
        ],
        disallow: '/',
      },
    ],
    sitemap: 'https://xdtv.fans/sitemap.xml',
  };
}
