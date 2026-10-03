import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Background worker that syncs live status, follower counts, and stream titles
 * from Twitch, YouTube, Kick, and TikTok APIs into the streamer_stats table.
 *
 * Runs every 2 minutes for live status, every 30 minutes for follower counts.
 * Updates the aggregate isLive / followerCount on streamer_profiles.
 */
@Injectable()
export class PlatformSyncService {
  private readonly logger = new Logger(PlatformSyncService.name);
  private twitchAppToken: string | null = null;
  private twitchTokenExpiresAt = 0;
  private kickAppToken: string | null = null;
  private kickTokenExpiresAt = 0;
  private youtubeRunning = false;
  /** Set when the API reports quotaExceeded; cleared at the next UTC midnight. */
  private youtubeQuotaBlockedUntil = 0;
  private liveRunning = false;
  private followersRunning = false;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private redis: RedisService,
  ) {}

  // ═══════════════════════════════════════════════════════
  //  LIVE STATUS — every 2 minutes
  // ═══════════════════════════════════════════════════════

  @Cron('*/2 * * * *')
  async syncLiveStatus() {
    if (this.liveRunning) {
      this.logger.warn('syncLiveStatus skipped — previous run still active');
      return;
    }
    this.liveRunning = true;
    try {
      // YouTube is deliberately NOT here — it runs on its own, much slower
      // schedule because it is the only one of the three with a hard daily
      // API quota. See syncYouTubeLiveScheduled().
      await Promise.allSettled([
        this.syncTwitchLive(),
        this.syncKickLive(),
      ]);
      await this.updateAggregateIsLive();
    } catch (err) {
      this.logger.error('syncLiveStatus failed', (err as Error).message);
    } finally {
      this.liveRunning = false;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  YOUTUBE LIVE — every 20 minutes (quota-bound)
  // ═══════════════════════════════════════════════════════

  /**
   * YouTube live status, on its own schedule.
   *
   * This used to run inside the 2-minute live cron, which quietly destroyed
   * it. Each pass costs ~93 videos.list calls, so at 720 passes a day it spent
   * ~66,960 units against a 10,000/day quota — the entire allowance gone in
   * about 3.6 hours, after which every call 403s and the sync reports zero
   * live for the rest of the day. It looked like "nobody streams on YouTube"
   * rather than like a broken integration.
   *
   * At 20 minutes and two candidate videos per channel the cost is roughly
   * 5,100 units/day, leaving room for the follower sync and headroom besides.
   */
  @Cron('*/20 * * * *')
  async syncYouTubeLiveScheduled() {
    if (this.youtubeRunning) return;
    if (Date.now() < this.youtubeQuotaBlockedUntil) return;

    this.youtubeRunning = true;
    try {
      await this.syncYouTubeLive();
    } catch (err) {
      this.logger.error('syncYouTubeLive failed', (err as Error).message);
    } finally {
      this.youtubeRunning = false;
    }
  }

  /** Stop calling the API until the quota resets at the next UTC midnight. */
  private blockYouTubeUntilQuotaReset(reason: string) {
    const next = new Date();
    next.setUTCHours(24, 0, 0, 0);
    this.youtubeQuotaBlockedUntil = next.getTime();
    this.logger.error(
      `YouTube API ${reason} — backing off until ${next.toISOString()}. Live status will be stale until then.`,
    );
  }

  // ═══════════════════════════════════════════════════════
  //  FOLLOWERS — every 30 minutes
  // ═══════════════════════════════════════════════════════

  @Cron('*/30 * * * *')
  async syncFollowers() {
    if (this.followersRunning) {
      this.logger.warn('syncFollowers skipped — previous run still active');
      return;
    }
    this.followersRunning = true;
    try {
      await Promise.allSettled([
        this.syncTwitchFollowers(),
        this.syncYouTubeFollowers(),
        this.syncKickFollowers(),
      ]);
      await this.updateAggregateFollowerCount();
    } catch (err) {
      this.logger.error('syncFollowers failed', (err as Error).message);
    } finally {
      this.followersRunning = false;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  TWITCH
  // ═══════════════════════════════════════════════════════

  private async getTwitchAppToken(): Promise<string> {
    if (this.twitchAppToken && Date.now() < this.twitchTokenExpiresAt) {
      return this.twitchAppToken;
    }
    const clientId = this.config.get('TWITCH_CLIENT_ID');
    const clientSecret = this.config.get('TWITCH_CLIENT_SECRET');
    if (!clientId || !clientSecret) return '';

    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      this.twitchAppToken = data.access_token;
      this.twitchTokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
      return data.access_token;
    }
    this.logger.warn('Failed to get Twitch app token');
    return '';
  }

  private async syncTwitchLive() {
    const streamers = await this.prisma.streamerProfile.findMany({
      where: { twitchId: { not: null } },
      select: { id: true, twitchId: true },
    });
    if (streamers.length === 0) return;

    const token = await this.getTwitchAppToken();
    if (!token) return;
    const clientId = this.config.get('TWITCH_CLIENT_ID');

    // Build map of all live streams
    const liveMap = new Map<string, any>();
    const batches = this.chunk(streamers, 100);
    for (const batch of batches) {
      const ids = batch.map(s => s.twitchId!);
      const params = ids.map(id => `user_id=${id}`).join('&');
      try {
        const res = await fetch(`https://api.twitch.tv/helix/streams?${params}`, {
          headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId },
        });
        const data = await res.json();
        for (const stream of data.data || []) {
          liveMap.set(stream.user_id, stream);
        }
      } catch (err) {
        this.logger.warn(`Twitch live batch failed: ${(err as Error).message}`);
      }
    }

    // Batch upsert via raw SQL
    const now = new Date();
    const upsertRows = streamers.map(s => {
      const stream = liveMap.get(s.twitchId!);
      const isLive = !!stream;
      const title = stream?.title || null;
      const viewers = stream?.viewer_count || 0;
      const thumb = stream?.thumbnail_url
        ?.replace('{width}', '440')
        .replace('{height}', '248') || null;
      return [s.id, 'TWITCH', isLive, title, viewers, thumb, now];
    });
    await this.batchUpsertRaw(
      'streamer_stats',
      [
        { name: 'streamer_profile_id', cast: 'int' },
        { name: 'platform', cast: '"Platform"' },
        { name: 'is_live', cast: 'boolean' },
        { name: 'stream_title', cast: 'text' },
        { name: 'viewer_count', cast: 'int' },
        { name: 'thumbnail_url', cast: 'text' },
        { name: 'updated_at', cast: 'timestamp(3)' },
      ],
      ['streamer_profile_id', 'platform'],
      ['is_live', 'stream_title', 'viewer_count', 'thumbnail_url', 'updated_at'],
      upsertRows,
    );
    this.logger.log(`Twitch live sync: ${streamers.length} streamers checked, ${liveMap.size} live`);
  }

  private async syncTwitchFollowers() {
    const streamers = await this.prisma.streamerProfile.findMany({
      where: { twitchId: { not: null } },
      select: { id: true, twitchId: true },
    });
    if (streamers.length === 0) return;

    const token = await this.getTwitchAppToken();
    if (!token) return;
    const clientId = this.config.get('TWITCH_CLIENT_ID');

    // Parallel fetch with concurrency limit of 20
    const results: { id: number; followers: number }[] = [];
    const batches = this.chunk(streamers, 20);
    for (const batch of batches) {
      const settled = await Promise.allSettled(
        batch.map(async (streamer) => {
          const res = await fetch(
            `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${streamer.twitchId}&first=1`,
            { headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId } },
          );
          const data = await res.json();
          return { id: streamer.id, followers: data.total ?? 0 };
        }),
      );
      for (const r of settled) {
        if (r.status === 'fulfilled') results.push(r.value);
      }
    }

    // Batch upsert
    const now = new Date();
    const upsertRows = results.map(r => [r.id, 'TWITCH', r.followers, now]);
    await this.batchUpsertRaw(
      'streamer_stats',
      [
        { name: 'streamer_profile_id', cast: 'int' },
        { name: 'platform', cast: '"Platform"' },
        { name: 'followers', cast: 'int' },
        { name: 'updated_at', cast: 'timestamp(3)' },
      ],
      ['streamer_profile_id', 'platform'],
      ['followers', 'updated_at'],
      upsertRows,
    );
    this.logger.log(`Twitch followers sync: ${results.length} updated`);
  }

  // ═══════════════════════════════════════════════════════
  //  YOUTUBE
  // ═══════════════════════════════════════════════════════

  private async syncYouTubeLive() {
    const streamers = await this.prisma.streamerProfile.findMany({
      where: { youtubeId: { not: null } },
      select: { id: true, youtubeId: true },
    });
    if (streamers.length === 0) return;

    const apiKey = this.config.get('YOUTUBE_API_KEY');
    if (!apiKey) return;

    // Step 1: Fetch YouTube RSS feeds (0 API quota) to get recent video IDs
    const videoIdToStreamer = new Map<string, number>();
    const rssBatches = this.chunk(streamers, 30);
    for (const batch of rssBatches) {
      const results = await Promise.allSettled(
        batch.map(async (streamer) => {
          const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${streamer.youtubeId}`;
          const res = await fetch(rssUrl, { signal: AbortSignal.timeout(5000) });
          const xml = await res.text();
          if (!xml.includes('<feed')) return null;
          // Two candidates rather than three: a live broadcast is almost
          // always the newest entry, and every extra id is quota spent.
          const matches = [...xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)].slice(0, 2);
          return matches.map(m => ({ streamerId: streamer.id, videoId: m[1] }));
        }),
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          for (const entry of r.value) {
            videoIdToStreamer.set(entry.videoId, entry.streamerId);
          }
        }
      }
    }

    // Step 2: Batch check video IDs via videos.list (1 unit per 50 videos vs search's 100 units each)
    const liveMap = new Map<number, { title: string; viewerCount: number; thumbnail: string | null }>();
    let apiFailed = false;
    const videoBatches = this.chunk(Array.from(videoIdToStreamer.keys()), 50);
    for (const batch of videoBatches) {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${batch.join(',')}&key=${apiKey}`,
        );
        const data = await res.json();

        // `data.items || []` used to swallow this: an error response has no
        // items, so a quota failure was indistinguishable from "nobody live".
        if (data.error) {
          const reason = data.error?.errors?.[0]?.reason || `HTTP ${res.status}`;
          if (reason === 'quotaExceeded' || res.status === 403) {
            this.blockYouTubeUntilQuotaReset(reason);
            apiFailed = true;
            break;
          }
          this.logger.warn(`YouTube videos.list error: ${reason}`);
          apiFailed = true;
          continue;
        }

        for (const video of data.items || []) {
          const lsd = video.liveStreamingDetails;
          // Currently live = has started but not ended
          if (lsd?.actualStartTime && !lsd?.actualEndTime) {
            const streamerId = videoIdToStreamer.get(video.id);
            if (streamerId !== undefined) {
              // Take the best size the API actually reports rather than
              // guessing a URL suffix. `medium` is mqdefault at 320x180,
              // which visibly upscales on a wall tile; maxres is 1280x720
              // and 16:9, matching the tile exactly. Falling back down the
              // list avoids inventing a URL that 404s.
              const thumbs = video.snippet?.thumbnails || {};
              const thumbnail =
                thumbs.maxres?.url ||
                thumbs.standard?.url ||
                thumbs.high?.url ||
                thumbs.medium?.url ||
                null;

              liveMap.set(streamerId, {
                title: video.snippet?.title || '',
                viewerCount: parseInt(lsd.concurrentViewers || '0', 10),
                thumbnail,
              });
            }
          }
        }
      } catch (err) {
        this.logger.warn(`YouTube videos.list batch failed: ${(err as Error).message}`);
      }
    }

    // Step 3: Batch upsert all results.
    //
    // If the API failed, writing this out would mark every YouTube streamer
    // offline on the strength of a failed request — the same behaviour that
    // made the Kick outage invisible. Leave the previous state instead.
    if (apiFailed && liveMap.size === 0) {
      this.logger.warn('YouTube live sync aborted — API unavailable, previous state kept');
      return;
    }

    const now = new Date();
    const upsertRows = streamers.map(s => {
      const live = liveMap.get(s.id);
      return [s.id, 'YOUTUBE', !!live, live?.title || null, live?.viewerCount || 0, live?.thumbnail || null, now];
    });
    await this.batchUpsertRaw(
      'streamer_stats',
      [
        { name: 'streamer_profile_id', cast: 'int' },
        { name: 'platform', cast: '"Platform"' },
        { name: 'is_live', cast: 'boolean' },
        { name: 'stream_title', cast: 'text' },
        { name: 'viewer_count', cast: 'int' },
        { name: 'thumbnail_url', cast: 'text' },
        { name: 'updated_at', cast: 'timestamp(3)' },
      ],
      ['streamer_profile_id', 'platform'],
      ['is_live', 'stream_title', 'viewer_count', 'thumbnail_url', 'updated_at'],
      upsertRows,
    );

    const apiCalls = videoBatches.length;
    this.logger.log(`YouTube live sync: ${streamers.length} channels, ${videoIdToStreamer.size} videos checked via ${apiCalls} API calls (RSS+videos.list), ${liveMap.size} live`);
  }

  private async syncYouTubeFollowers() {
    const streamers = await this.prisma.streamerProfile.findMany({
      where: { youtubeId: { not: null } },
      select: { id: true, youtubeId: true },
    });
    if (streamers.length === 0) return;

    const apiKey = this.config.get('YOUTUBE_API_KEY');
    if (!apiKey) return;

    // Batch up to 50 channel IDs
    const batches = this.chunk(streamers, 50);
    for (const batch of batches) {
      const ids = batch.map(s => s.youtubeId!).join(',');
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${ids}&key=${apiKey}`,
        );
        const data = await res.json();
        const channelMap = new Map<string, number>();
        for (const ch of data.items || []) {
          channelMap.set(ch.id, parseInt(ch.statistics.subscriberCount || '0', 10));
        }
        // Batch upsert (same path as the Twitch/Kick syncs) — a per-row
        // prisma.upsert() here compiled to INSERT ... ON CONFLICT, which burned
        // a sequence value per streamer per run. See batchUpsertRaw for detail.
        const now = new Date();
        const upsertRows = batch.map(streamer => [
          streamer.id,
          'YOUTUBE',
          channelMap.get(streamer.youtubeId!) ?? 0,
          now,
        ]);
        await this.batchUpsertRaw(
          'streamer_stats',
          [
            { name: 'streamer_profile_id', cast: 'int' },
            { name: 'platform', cast: '"Platform"' },
            { name: 'followers', cast: 'int' },
            { name: 'updated_at', cast: 'timestamp(3)' },
          ],
          ['streamer_profile_id', 'platform'],
          ['followers', 'updated_at'],
          upsertRows,
        );
      } catch (err) {
        this.logger.warn(`YouTube followers sync failed: ${(err as Error).message}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  //  KICK
  // ═══════════════════════════════════════════════════════

  /**
   * Kick app access token (client_credentials), cached until shortly before
   * expiry — same pattern as the Twitch one.
   */
  private async getKickAppToken(): Promise<string> {
    if (this.kickAppToken && Date.now() < this.kickTokenExpiresAt) {
      return this.kickAppToken;
    }
    const clientId = this.config.get('KICK_CLIENT_ID');
    const clientSecret = this.config.get('KICK_CLIENT_SECRET');
    if (!clientId || !clientSecret) return '';

    try {
      const res = await fetch('https://id.kick.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const data = await res.json();
      if (data.access_token) {
        this.kickAppToken = data.access_token;
        this.kickTokenExpiresAt = Date.now() + ((data.expires_in ?? 3600) - 300) * 1000;
        return data.access_token;
      }
      this.logger.warn(`Failed to get Kick app token: ${JSON.stringify(data).slice(0, 200)}`);
    } catch (err) {
      this.logger.warn(`Kick token request failed: ${(err as Error).message}`);
    }
    return '';
  }

  /**
   * Fetch Kick channels from the official public API.
   *
   * The previous implementation called https://kick.com/api/v2/channels/<slug>,
   * an unofficial endpoint that now sits behind Cloudflare and answers 403 to
   * every server-side request. Because the code treated a non-ok response as
   * "not live" rather than an error, Kick reported 0 live out of 3,916
   * streamers on every run and no Kick stream or thumbnail ever appeared —
   * silently, for as long as Cloudflare has been blocking it.
   *
   * api.kick.com/public/v1/channels is the supported endpoint, takes an app
   * token, and accepts up to 50 broadcaster ids per call. Every kickId we
   * store is already a numeric broadcaster_user_id.
   */
  private async fetchKickChannels(kickIds: string[]): Promise<Map<string, any>> {
    const out = new Map<string, any>();
    const token = await this.getKickAppToken();
    if (!token) return out;

    for (const batch of this.chunk(kickIds, 50)) {
      const qs = batch.map((id) => `broadcaster_user_id=${encodeURIComponent(id)}`).join('&');
      try {
        const res = await fetch(`https://api.kick.com/public/v1/channels?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          this.logger.warn(`Kick channels batch failed: HTTP ${res.status}`);
          continue;
        }
        const data = await res.json();
        for (const ch of data.data || []) {
          if (ch.broadcaster_user_id != null) out.set(String(ch.broadcaster_user_id), ch);
        }
      } catch (err) {
        this.logger.warn(`Kick channels batch error: ${(err as Error).message}`);
      }
    }
    return out;
  }

  private async syncKickLive() {
    const streamers = await this.prisma.streamerProfile.findMany({
      where: { kickId: { not: null } },
      select: { id: true, kickId: true },
    });
    if (streamers.length === 0) return;

    const channels = await this.fetchKickChannels(streamers.map((s) => s.kickId!));
    if (channels.size === 0) {
      this.logger.warn('Kick live sync: no channels returned — leaving previous state intact');
      return;
    }

    const now = new Date();
    const upsertRows = streamers.map((s) => {
      const ch = channels.get(s.kickId!);
      const stream = ch?.stream;
      const isLive = Boolean(stream?.is_live);
      return [
        s.id,
        'KICK',
        isLive,
        isLive ? ch?.stream_title || null : null,
        isLive ? stream?.viewer_count || 0 : 0,
        isLive ? stream?.thumbnail || null : null,
        now,
      ];
    });

    await this.batchUpsertRaw(
      'streamer_stats',
      [
        { name: 'streamer_profile_id', cast: 'int' },
        { name: 'platform', cast: '"Platform"' },
        { name: 'is_live', cast: 'boolean' },
        { name: 'stream_title', cast: 'text' },
        { name: 'viewer_count', cast: 'int' },
        { name: 'thumbnail_url', cast: 'text' },
        { name: 'updated_at', cast: 'timestamp(3)' },
      ],
      ['streamer_profile_id', 'platform'],
      ['is_live', 'stream_title', 'viewer_count', 'thumbnail_url', 'updated_at'],
      upsertRows,
    );

    const liveCount = upsertRows.filter((r) => r[2]).length;
    this.logger.log(
      `Kick live sync: ${streamers.length} streamers checked, ${channels.size} resolved, ${liveCount} live`,
    );
  }

  private async syncKickFollowers() {
    const streamers = await this.prisma.streamerProfile.findMany({
      where: { kickId: { not: null } },
      select: { id: true, kickId: true, kickUrl: true },
    });
    if (streamers.length === 0) return;

    // Same migration as syncKickLive: the unofficial kick.com/api/v2 endpoint
    // is Cloudflare-blocked and returned 403 for every request, so follower
    // counts silently stopped updating too.
    //
    // The public API does not expose a follower count, but it does return
    // subscriber counts. Follower numbers are therefore left untouched rather
    // than overwritten with zeros — a stale number is better than a wrong one.
    const channels = await this.fetchKickChannels(streamers.map((s) => s.kickId!));
    const results: { id: number; followers: number }[] = [];
    for (const s of streamers) {
      const ch = channels.get(s.kickId!);
      const subs = ch?.active_subscribers_count;
      if (typeof subs === 'number' && subs > 0) {
        results.push({ id: s.id, followers: subs });
      }
    }

    // Batch upsert
    const now = new Date();
    const upsertRows = results.map(r => [r.id, 'KICK', r.followers, now]);
    await this.batchUpsertRaw(
      'streamer_stats',
      [
        { name: 'streamer_profile_id', cast: 'int' },
        { name: 'platform', cast: '"Platform"' },
        { name: 'followers', cast: 'int' },
        { name: 'updated_at', cast: 'timestamp(3)' },
      ],
      ['streamer_profile_id', 'platform'],
      ['followers', 'updated_at'],
      upsertRows,
    );
    this.logger.log(`Kick followers sync: ${results.length} updated`);
  }

  // ═══════════════════════════════════════════════════════
  //  AGGREGATE UPDATE — push is-live & follower totals
  //  back to streamer_profiles for fast queries
  // ═══════════════════════════════════════════════════════

  private async updateAggregateIsLive() {
    // Turn off profiles no longer live on any platform
    await this.prisma.$executeRaw`
      UPDATE streamer_profiles sp
      SET is_live = false
      WHERE sp.is_live = true
        AND NOT EXISTS (
          SELECT 1 FROM streamer_stats ss
          WHERE ss.streamer_profile_id = sp.id AND ss.is_live = true
        )
    `;
    // Turn on profiles that are live on any platform
    await this.prisma.$executeRaw`
      UPDATE streamer_profiles sp
      SET is_live = true
      FROM streamer_stats ss
      WHERE ss.streamer_profile_id = sp.id
        AND ss.is_live = true
        AND sp.is_live = false
    `;
    await this.redis.delPattern('streamers:list:*');
  }

  private async updateAggregateFollowerCount() {
    // Single SQL: sum followers per streamer and update in one go
    await this.prisma.$executeRaw`
      UPDATE streamer_profiles sp
      SET follower_count = COALESCE(sub.total, 0)
      FROM (
        SELECT streamer_profile_id, SUM(followers) AS total
        FROM streamer_stats
        GROUP BY streamer_profile_id
      ) sub
      WHERE sp.id = sub.streamer_profile_id
        AND sp.follower_count IS DISTINCT FROM COALESCE(sub.total, 0)
    `;
    await this.redis.delPattern('streamers:list:*');
  }

  // ═══════════════════════════════════════════════════════
  //  TWITCH CLIP THUMBNAILS — weekly refresh
  // ═══════════════════════════════════════════════════════

  /**
   * Re-fetch clip thumbnails from the Twitch API.
   *
   * Twitch expires clip thumbnails: the stored URL starts 302-redirecting to
   * ttv-static/404_preview.jpg, which is a real 200 image, so nothing errors
   * and the card renders Twitch's grey "404" graphic instead of ours. A
   * sample of 20 clips found 8 already dead, at every size — the URLs rot
   * regardless of the resolution requested.
   *
   * Every clip stores its Twitch slug in external_id, so the current
   * thumbnail can be read back from Helix rather than guessed. Clips Twitch
   * no longer returns have been deleted at source; their thumbnail is cleared
   * so ClipCard falls back to its own placeholder.
   */
  @Cron('0 4 * * 0')
  async refreshTwitchClipThumbnails(limit = 20000) {
    const token = await this.getTwitchAppToken();
    if (!token) {
      this.logger.warn('Clip thumbnail refresh skipped — no Twitch app token');
      return { checked: 0, updated: 0, cleared: 0 };
    }
    const clientId = this.config.get('TWITCH_CLIENT_ID');

    const clips = await this.prisma.post.findMany({
      where: { type: 'CLIP', clipSource: 'TWITCH', isDeleted: false, externalId: { not: null } },
      select: { id: true, externalId: true, thumbnailUrl: true },
      take: limit,
    });
    if (clips.length === 0) return { checked: 0, updated: 0, cleared: 0 };

    let updated = 0;
    let cleared = 0;

    // Helix accepts up to 100 ids per request.
    for (const batch of this.chunk(clips, 100)) {
      const qs = batch.map((c) => `id=${encodeURIComponent(c.externalId!)}`).join('&');
      let live: Record<string, string> = {};

      try {
        const res = await fetch(`https://api.twitch.tv/helix/clips?${qs}`, {
          headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId },
        });
        if (!res.ok) {
          this.logger.warn(`Clip thumbnail batch failed: HTTP ${res.status}`);
          continue;
        }
        const data = await res.json();
        for (const c of data.data || []) {
          if (c.id && c.thumbnail_url) live[c.id] = c.thumbnail_url;
        }
      } catch (err) {
        this.logger.warn(`Clip thumbnail batch error: ${(err as Error).message}`);
        continue;
      }

      for (const clip of batch) {
        const fresh = live[clip.externalId!];

        if (fresh && fresh !== clip.thumbnailUrl) {
          await this.prisma.post.update({
            where: { id: clip.id },
            data: { thumbnailUrl: fresh },
          });
          updated++;
        } else if (!fresh && clip.thumbnailUrl) {
          // Twitch did not return the clip — it is gone. Clearing the URL is
          // better than leaving one that renders their 404 placeholder.
          await this.prisma.post.update({
            where: { id: clip.id },
            data: { thumbnailUrl: null },
          });
          cleared++;
        }
      }
    }

    await this.redis.delPattern('feed:*');
    await this.redis.delPattern('posts:list:*');
    this.logger.log(
      `Clip thumbnails: ${clips.length} checked, ${updated} refreshed, ${cleared} cleared (deleted at source)`,
    );
    return { checked: clips.length, updated, cleared };
  }

  // ═══════════════════════════════════════════════════════
  //  UTILS
  // ═══════════════════════════════════════════════════════

  private async batchUpsertRaw(
    table: string,
    columns: { name: string; cast?: string }[],
    conflictColumns: string[],
    updateColumns: string[],
    rows: any[][],
    batchSize = 500,
  ) {
    if (rows.length === 0) return;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const params: any[] = [];
      const valueClauses: string[] = [];
      let idx = 1;
      for (const row of batch) {
        const placeholders: string[] = [];
        for (let c = 0; c < columns.length; c++) {
          const cast = columns[c].cast ? `::${columns[c].cast}` : '';
          placeholders.push(`$${idx++}${cast}`);
          params.push(row[c]);
        }
        valueClauses.push(`(${placeholders.join(', ')})`);
      }
      const colNames = columns.map(c => c.name).join(', ');
      const values = valueClauses.join(', ');
      const keyMatch = conflictColumns.map(c => `t.${c} = v.${c}`).join(' AND ');

      // Every column must carry an explicit cast. In the previous
      // `INSERT ... VALUES` form Postgres inferred parameter types from the
      // target column list; a standalone `(VALUES ...)` has no such anchor and
      // silently types bare parameters as `text`, which then fails with
      // "operator does not exist: integer = text".
      const missingCast = columns.filter(c => !c.cast).map(c => c.name);
      if (missingCast.length > 0) {
        throw new Error(
          `batchUpsertRaw(${table}): missing cast for column(s) ${missingCast.join(', ')}`,
        );
      }

      // NOTE: this deliberately does NOT use `INSERT ... ON CONFLICT DO UPDATE`.
      // That form makes Postgres evaluate the `id` column DEFAULT (nextval) for
      // *every* candidate row, including the ones that only conflict-and-update.
      // With this table re-synced every 2 minutes that exhausted
      // streamer_stats_id_seq (int32) while holding only ~35k rows.
      // Update-then-insert only touches the sequence for genuinely new rows.

      // 1) Update the rows that already exist — never touches the sequence.
      const updateSet = updateColumns.map(c => `${c} = v.${c}`).join(', ');
      await this.prisma.$executeRawUnsafe(
        `
        UPDATE ${table} AS t
        SET ${updateSet}
        FROM (VALUES ${values}) AS v(${colNames})
        WHERE ${keyMatch}
        `,
        ...params,
      );

      // 2) Insert only the rows that are genuinely missing.
      //    DISTINCT ON guards against duplicate keys inside a single batch.
      await this.prisma.$executeRawUnsafe(
        `
        INSERT INTO ${table} (${colNames})
        SELECT DISTINCT ON (${conflictColumns.join(', ')}) ${colNames}
        FROM (VALUES ${values}) AS v(${colNames})
        WHERE NOT EXISTS (
          SELECT 1 FROM ${table} AS t WHERE ${keyMatch}
        )
        ON CONFLICT (${conflictColumns.join(', ')}) DO NOTHING
        `,
        ...params,
      );
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  private extractKickSlug(url?: string | null): string | null {
    if (!url) return null;
    const match = url.match(/kick\.com\/([^/?#]+)/);
    return match?.[1] || null;
  }
}
