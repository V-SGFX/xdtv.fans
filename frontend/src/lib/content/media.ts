const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Image sources in the corpus, measured 2026-08-11:
 *
 *   static-cdn.jtvnw.net   16,318 clips + 1,104 live  →  16:9, upscalable
 *   i.ytimg.com               363 clips               →  4:3 hqdefault
 *   www.dexerto.com         1,466 articles            →  already 1080w
 *   /uploads/*              user uploads              →  served by the API
 */

/** Prefix API-relative upload paths. */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/uploads')) return `${API_URL}${url}`;
  return url;
}

/**
 * Twitch stores clip thumbnails at 480x272 and live previews at 440x248, both
 * of which upscale visibly on a wide desktop tile. Larger renditions exist at
 * the same URL — verified live: 1280x720 returns 200 at ~97KB — so this is a
 * render-time swap rather than a storage migration.
 */
export function upscaleTwitch(url: string, width: 640 | 1280 = 1280): string {
  const height = width === 1280 ? 720 : 360;
  return url
    .replace(/preview-\d+x\d+/, `preview-${width}x${height}`)
    .replace(/-\d+x\d+(\.jpg)/, `-${width}x${height}$1`);
}

/**
 * Best available thumbnail for a clip.
 *
 * YouTube's hqdefault is 4:3 with letterboxing baked in; it is deliberately
 * left alone rather than rewritten to maxresdefault, which 404s on older
 * videos. object-cover crops the bars, and this path is only 2.2% of clips.
 */
export function clipThumbnail(
  source: { thumbnailUrl?: string | null; clipSource?: string | null; externalId?: string | null },
  width: 640 | 1280 = 1280,
): string | null {
  const raw = resolveMediaUrl(source.thumbnailUrl);

  if (raw) {
    if (raw.includes('jtvnw.net')) return upscaleTwitch(raw, width);
    return raw;
  }

  // No stored thumbnail — derive one for YouTube clips.
  if (source.clipSource === 'YOUTUBE' && source.externalId) {
    return `https://i.ytimg.com/vi/${source.externalId}/hqdefault.jpg`;
  }

  return null;
}

/**
 * Kick serves stream thumbnails at .../<height>.webp and offers 480, 720 and
 * 1080 at the same path — same idea as the Twitch swap, different shape.
 */
export function upscaleKick(url: string, width: 640 | 1280 = 1280): string {
  const height = width === 1280 ? 720 : 480;
  return url.replace(/\/\d+\.webp$/, `/${height}.webp`);
}

/** Live preview for a streamer's active stream. */
export function liveThumbnail(url: string | null | undefined, width: 640 | 1280 = 1280): string | null {
  const raw = resolveMediaUrl(url);
  if (!raw) return null;
  if (raw.includes('jtvnw.net')) return upscaleTwitch(raw, width);
  if (raw.includes('images.kick.com')) return upscaleKick(raw, width);
  return raw;
}

/**
 * `sizes` for a tile in the content wall.
 *
 * The wall is 4 columns ≥1280px, 2 ≥768px, 1 below, so a `span 2` tile is
 * half the viewport on desktop and full width on mobile. Getting this right is
 * what stops the browser downloading a 1280px image for a 380px phone slot.
 */
export const WALL_TILE_SIZES = {
  /** span 1 — quarter width on desktop */
  narrow: '(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw',
  /** span 2 — half width on desktop, the default for clips and live */
  wide: '(min-width: 1280px) 50vw, (min-width: 768px) 50vw, 100vw',
  /** span 4 — full width hero */
  hero: '100vw',
} as const;

/** Seconds → m:ss. Returns null when there is no duration to show. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Compact counts. Clip view counts reach 43M in this corpus, so the full
 * number would dominate a tile that is otherwise 11px metadata.
 */
export function formatCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return String(v);
}
