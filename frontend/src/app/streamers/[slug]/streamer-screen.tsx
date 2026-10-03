'use client';

import { Suspense, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, ExternalLink, Radio, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { TabBar } from '@/components/ui/tab-bar';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Feed } from '@/components/content/feed';
import { FollowButton } from '@/components/content/follow-button';
import { streamerQuery } from '@/lib/queries/feed-query';
import { LiveEmbed, type LivePlatform } from '@/components/content/live-embed';
import { Crown } from 'lucide-react';
import { formatCount, liveThumbnail } from '@/lib/content/media';

type ProfileTab = 'clips' | 'posts' | 'about';
const TABS: ProfileTab[] = ['clips', 'posts', 'about'];

interface StreamerDetail {
  id: number;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isLive: boolean;
  isVerified: boolean;
  isClaimed: boolean;
  followerCount: number;
  twitchUrl: string | null;
  youtubeUrl: string | null;
  kickUrl: string | null;
  twitterUrl: string | null;
  stats?: {
    platform: string;
    isLive: boolean;
    viewerCount: number;
    streamTitle: string | null;
    thumbnailUrl: string | null;
  }[];
  _count?: { follows: number; posts: number };
}

/**
 * Streamer profile.
 *
 * Was 857 lines firing five separate requests for five tabs, each with its own
 * grid. It answers one question now — what is this streamer doing and what is
 * worth watching — so the identity header is compact and the content starts
 * immediately, rendered by the same wall as every other surface.
 */
function StreamerInner({ slug }: { slug: string }) {
  const t = useTranslations('streamers');
  const tf = useTranslations('feed');
  const router = useRouter();
  const searchParams = useSearchParams();

  const param = searchParams.get('tab');
  const active: ProfileTab = (TABS as string[]).includes(param ?? '')
    ? (param as ProfileTab)
    : 'clips';

  const { data: streamer, isLoading } = useQuery({
    ...streamerQuery(slug),
    select: (d) => d as StreamerDetail,
  });

  const setTab = useCallback(
    (tab: ProfileTab) => {
      const qs = new URLSearchParams();
      if (tab !== 'clips') qs.set('tab', tab);
      const s = qs.toString();
      router.replace(s ? `/streamers/${slug}?${s}` : `/streamers/${slug}`, { scroll: false });
    },
    [router, slug],
  );

  if (isLoading || !streamer) {
    return (
      <AppLayout>
        <Skeleton className="mb-4 aspect-[6/1] w-full rounded-lg" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const liveStat = (streamer.stats ?? []).find((s) => s.isLive);
  const banner = liveThumbnail(liveStat?.thumbnailUrl) ?? streamer.bannerUrl;

  // Which profile URL belongs to the platform currently broadcasting. The
  // channel name comes from that URL, so a streamer live on Kick does not
  // get a Twitch player pointed at a name that may not even exist there.
  const liveChannelUrl =
    liveStat?.platform === 'TWITCH' ? streamer.twitchUrl
    : liveStat?.platform === 'KICK' ? streamer.kickUrl
    : liveStat?.platform === 'YOUTUBE' ? streamer.youtubeUrl
    : null;
  const externals = [
    { url: streamer.twitchUrl, label: 'Twitch' },
    { url: streamer.youtubeUrl, label: 'YouTube' },
    { url: streamer.kickUrl, label: 'Kick' },
    { url: streamer.twitterUrl, label: 'X' },
  ].filter((l): l is { url: string; label: string } => Boolean(l.url));

  const labels: Record<ProfileTab, string> = {
    clips: t('clips'),
    posts: t('posts'),
    about: t('about'),
  };

  return (
    <AppLayout>
      {/* Live: the stream itself, not a picture of it. A profile opened while
          someone is broadcasting should let you watch without leaving —
          the whole point of listing streamers here rather than linking out. */}
      {liveStat && liveChannelUrl ? (
        <div className="-mx-4 mb-3 sm:mx-0">
          <LiveEmbed
            platform={liveStat.platform as LivePlatform}
            channelUrl={liveChannelUrl}
            title={liveStat.streamTitle}
            thumbnailUrl={liveThumbnail(liveStat.thumbnailUrl)}
            viewerCount={liveStat.viewerCount}
          />
        </div>
      ) : (
      <div className="relative -mx-4 mb-3 aspect-[6/1] min-h-[120px] overflow-hidden bg-surface-sunken sm:mx-0 sm:rounded-lg">
        {banner && (
          <Image
            src={banner}
            alt=""
            fill
            sizes="(min-width: 1024px) 1024px, 100vw"
            priority
            className="object-cover"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-surface-base via-surface-base/40 to-transparent"
        />
      </div>
      )}

      <header className="mb-4 flex flex-wrap items-start gap-3">
        <Avatar
          src={streamer.avatarUrl}
          name={streamer.name}
          size="lg"
          status={streamer.isLive ? 'live' : 'none'}
        />

        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 text-lg font-bold text-content-primary">
            <span className="truncate">{streamer.name}</span>
            {streamer.isVerified && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-accent" aria-label={t('verified')} />
            )}
          </h1>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-content-muted">
            {streamer.isLive && (
              <Badge variant="live">
                LIVE
                {liveStat?.viewerCount ? (
                  <span className="tabular-nums">{formatCount(liveStat.viewerCount)}</span>
                ) : null}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Users className="h-3 w-3" aria-hidden="true" />
              {formatCount(streamer.followerCount)}
            </span>
          </div>

          {liveStat?.streamTitle && (
            <p className="mt-1.5 line-clamp-2 text-sm text-content-secondary">
              {liveStat.streamTitle}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <FollowButton target={{ kind: 'streamer', id: streamer.id }} />
          {externals[0] && (
            <a
              href={externals[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-content-secondary transition-colors hover:border-line-strong hover:text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              {t('watch')}
            </a>
          )}
        </div>
      </header>

      {/* Przejęcie kanału.
          Strona przejmowania istniała, ale nie prowadził do niej ani jeden
          odnośnik w całej aplikacji — dało się na nią wejść wyłącznie
          wpisując adres ręcznie. Właściciel kanału trafia tu naturalnie,
          szukając własnego profilu, więc zaproszenie należy do tego miejsca. */}
      {!streamer.isClaimed && (
        <a
          href={`/claim/${slug}`}
          className="mb-4 flex items-center gap-2 rounded-lg border border-dashed border-border-default px-4 py-3 text-sm text-content-muted transition-colors hover:border-neon-cyan hover:text-content-primary"
        >
          <Crown className="h-4 w-4 shrink-0 text-neon-yellow" />
          <span>{t('claimPrompt')}</span>
        </a>
      )}

      <TabBar
        idPrefix="profile"
        label={streamer.name}
        value={active}
        onChange={setTab}
        items={TABS.map((v) => ({ value: v, label: labels[v] }))}
      />

      <div id="profile-panel" role="tabpanel" aria-labelledby={`profile-tab-${active}`} tabIndex={-1}>
        {active === 'clips' && (
          <Feed
            filters={{ streamer: slug, type: 'CLIP' }}
            label={`${streamer.name} — ${labels.clips}`}
            emptyTitle={tf('emptyTitle')}
            emptyDescription={tf('emptyDesc')}
          />
        )}

        {active === 'posts' && (
          <Feed
            filters={{ streamer: slug }}
            label={`${streamer.name} — ${labels.posts}`}
            emptyTitle={tf('emptyTitle')}
            emptyDescription={tf('emptyDesc')}
          />
        )}

        {active === 'about' && (
          <div className="space-y-4 rounded-lg border border-line bg-surface-raised p-4">
            {streamer.bio ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
                {streamer.bio}
              </p>
            ) : (
              <p className="text-sm text-content-muted">{tf('emptyDesc')}</p>
            )}

            {externals.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {externals.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1 text-xs text-content-secondary transition-colors hover:border-line-strong hover:text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export function StreamerScreen({ slug }: { slug: string }) {
  return (
    <Suspense fallback={null}>
      <StreamerInner slug={slug} />
    </Suspense>
  );
}
