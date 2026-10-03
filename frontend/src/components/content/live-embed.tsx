'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Play, ExternalLink } from 'lucide-react';

export type LivePlatform = 'TWITCH' | 'KICK' | 'YOUTUBE';

interface LiveEmbedProps {
  platform: LivePlatform;
  /** Profile URL on that platform — the channel name is taken from its path. */
  channelUrl: string;
  title?: string | null;
  thumbnailUrl?: string | null;
  viewerCount?: number;
}

/**
 * The channel name is the last non-empty path segment: twitch.tv/kiss180,
 * kick.com/kiss180, youtube.com/@kiss180. The leading "@" that YouTube
 * handles carry is dropped, and query strings are ignored.
 */
function channelFrom(url: string): string | null {
  try {
    const path = new URL(url).pathname.split('/').filter(Boolean);
    const name = path[path.length - 1];
    return name ? name.replace(/^@/, '') : null;
  } catch {
    return null;
  }
}

/**
 * Live stream player.
 *
 * Not rendered on the server. Twitch refuses to load unless the `parent`
 * query parameter matches the host that frames it, so the URL cannot be
 * built until the hostname is known. Hard-coding "xdtv.fans" would work in
 * production and leave a black rectangle on every developer machine and
 * preview deployment — the kind of breakage nobody sees until someone else
 * tries to run the project.
 */
function embedUrl(platform: LivePlatform, channel: string, host: string): string | null {
  switch (platform) {
    case 'TWITCH':
      return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${host}&autoplay=false`;
    case 'KICK':
      return `https://player.kick.com/${encodeURIComponent(channel)}?autoplay=false`;
    case 'YOUTUBE':
      // YouTube has no by-name live embed. Handles resolve to a channel page,
      // not to the video currently airing, so an iframe here would show a
      // "video unavailable" panel. Better an honest link than a broken frame.
      return null;
    default:
      return null;
  }
}

export function LiveEmbed({
  platform,
  channelUrl,
  title,
  thumbnailUrl,
  viewerCount,
}: LiveEmbedProps) {
  const t = useTranslations('streamers');
  const [host, setHost] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => setHost(window.location.hostname), []);

  const channel = channelFrom(channelUrl);
  const src = channel && host ? embedUrl(platform, channel, host) : null;

  // Poster first, player on click. A profile page is often opened to read the
  // clips below, and an autostarting stream costs bandwidth on both sides
  // while talking over whatever the visitor is already listening to.
  if (!playing || !src) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        {thumbnailUrl && (
          <Image
            src={thumbnailUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 900px, 100vw"
            className="object-cover opacity-70"
            unoptimized
          />
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/80 to-black/20 p-4 text-center">
          {title && (
            <p className="line-clamp-2 max-w-lg text-sm font-medium text-white">{title}</p>
          )}

          {src ? (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="flex items-center gap-2 rounded-full bg-neon-pink px-5 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-105"
            >
              <Play className="h-4 w-4 fill-current" />
              {t('watchLive')}
            </button>
          ) : (
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              <ExternalLink className="h-4 w-4" />
              {t('watchOn', { platform: platform.charAt(0) + platform.slice(1).toLowerCase() })}
            </a>
          )}

          {typeof viewerCount === 'number' && viewerCount > 0 && (
            <p className="text-2xs text-white/70">
              {viewerCount.toLocaleString('pl-PL')} {t('watching')}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe
        src={src}
        title={title ?? t('liveStream')}
        className="h-full w-full"
        allow="autoplay; fullscreen; encrypted-media"
        allowFullScreen
        style={{ border: 'none' }}
      />
    </div>
  );
}
