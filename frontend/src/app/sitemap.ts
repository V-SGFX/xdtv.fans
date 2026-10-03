import type { MetadataRoute } from 'next';

const BASE_URL = 'https://xdtv.fans';
const API_URL = 'http://127.0.0.1:4000';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/discover?tab=streamers`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/posts`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: `${BASE_URL}/news`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: `${BASE_URL}/clips`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/community`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/search`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.4 },
  ];

  // Posts
  try {
    const res = await fetch(`${API_URL}/api/posts?limit=500`);
    if (res.ok) {
      const json = await res.json();
      for (const p of json.data || []) {
        entries.push({
          url: `${BASE_URL}/posts/${p.id}`,
          lastModified: new Date(p.createdAt),
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
    }
  } catch {}

  // Clips pages
  try {
    const res = await fetch(`${API_URL}/api/posts?type=CLIP&limit=500`);
    if (res.ok) {
      const json = await res.json();
      for (const clip of json.data || []) {
        entries.push({
          url: `${BASE_URL}/clips/${clip.id}`,
          lastModified: new Date(clip.createdAt),
          changeFrequency: 'weekly',
          priority: 0.75,
        });
      }
    }
  } catch {}

  // Community filtered pages
  try {
    const res = await fetch(`${API_URL}/api/communities`);
    if (res.ok) {
      const json = await res.json();
      for (const c of json || []) {
        entries.push({
          url: `${BASE_URL}/community?community=${encodeURIComponent(c.slug)}`,
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 0.65,
        });
      }
    }
  } catch {}

  // Streamers — fetch all pages
  let page = 1;
  const limit = 5000;
  let hasMore = true;
  while (hasMore) {
    try {
      const res = await fetch(`${API_URL}/api/streamers?limit=${limit}&page=${page}&sort=name`);
      if (!res.ok) break;
      const json = await res.json();
      const data = json.data || [];
      for (const s of data) {
        entries.push({
          url: `${BASE_URL}/streamers/${s.slug}`,
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 0.7,
        });
      }
      hasMore = data.length === limit;
      page++;
    } catch {
      break;
    }
  }

  return entries;
}
