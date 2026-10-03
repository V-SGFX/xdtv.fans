import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Scheduled clip ingest.
 *
 * Clips arrived once, by hand, on 2026-04-20 via scripts/import-twitch-clips.ts
 * and nothing has arrived since — the corpus was a snapshot, not a feed. This
 * runs the same idea on a schedule.
 *
 * Two differences from the script it replaces:
 *
 *  - It tags clips with their game. The script stored game_id and dropped it,
 *    which is why only 42% of the corpus carries a GAME tag and the rest are
 *    unreachable from Discover. Twitch tells us the game per clip; resolving
 *    it costs one extra call per 100 distinct games and makes the whole
 *    Discover > Games surface work for new content.
 *
 *  - It walks streamers in a rotating window rather than all 29,292 at once.
 *    A full pass is ~29k Helix calls; at one pass an hour that is far past
 *    the rate limit, and most of those streamers have no new clips anyway.
 *
 * Kick is deliberately absent. Its public API exposes no clips endpoint (404)
 * and every unofficial route is Cloudflare-blocked (403), verified directly.
 * A Kick grabber would return zero forever, which is exactly the kind of
 * silent no-op this codebase already had too much of.
 */

/** How many streamers to check per run. */
const BATCH_SIZE = 300;
/** Clips created in this window are considered new. */
const LOOKBACK_DAYS = 7;
/** Clips requested per streamer. */
const PER_STREAMER = 10;
/** Author for ingested clips — the existing xdtv_mapet bot account. */
const BOT_USER_ID = 4;

interface TwitchClip {
  id: string;
  url: string;
  broadcaster_id: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  game_id: string;
}

@Injectable()
export class ClipGrabberService {
  private readonly logger = new Logger(ClipGrabberService.name);
  private running = false;
  private appToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private redis: RedisService,
  ) {}

  private async getToken(): Promise<string> {
    if (this.appToken && Date.now() < this.tokenExpiresAt) return this.appToken;

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
    if (!data.access_token) {
      this.logger.warn('Clip grabber: failed to get Twitch app token');
      return '';
    }
    this.appToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
    return data.access_token;
  }

  @Cron('20 * * * *')
  async scheduledGrab() {
    if (this.running) {
      this.logger.warn('Clip grab skipped — previous run still active');
      return;
    }
    this.running = true;
    try {
      await this.grabTwitchClips();
    } catch (err) {
      this.logger.error('Clip grab failed', (err as Error).message);
    } finally {
      this.running = false;
    }
  }

  /**
   * Which slice of streamers to check this run.
   *
   * The cursor is kept in Redis so consecutive runs advance through the list
   * instead of re-checking the same first 300 forever.
   */
  private async nextBatch(): Promise<{ id: number; twitchId: string; name: string }[]> {
    const cursorRaw = await this.redis.get('clipgrab:cursor');
    const cursor = cursorRaw ? parseInt(cursorRaw, 10) : 0;

    const rows = await this.prisma.streamerProfile.findMany({
      where: { twitchId: { not: null }, id: { gt: cursor } },
      select: { id: true, twitchId: true, name: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });

    // Wrap around when the end is reached.
    const next = rows.length > 0 ? rows[rows.length - 1].id : 0;
    await this.redis.set('clipgrab:cursor', String(rows.length < BATCH_SIZE ? 0 : next), 86400);

    return rows as { id: number; twitchId: string; name: string }[];
  }

  async grabTwitchClips() {
    const token = await this.getToken();
    if (!token) return { checked: 0, imported: 0 };
    const clientId = this.config.get('TWITCH_CLIENT_ID');

    const streamers = await this.nextBatch();
    if (streamers.length === 0) return { checked: 0, imported: 0 };

    const startedAt = new Date();
    startedAt.setDate(startedAt.getDate() - LOOKBACK_DAYS);

    const collected: { clip: TwitchClip; streamerId: number; name: string }[] = [];

    for (const s of streamers) {
      const url = new URL('https://api.twitch.tv/helix/clips');
      url.searchParams.set('broadcaster_id', s.twitchId);
      url.searchParams.set('first', String(PER_STREAMER));
      url.searchParams.set('started_at', startedAt.toISOString());

      try {
        const res = await fetch(url.toString(), {
          headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` },
        });
        if (res.status === 429) {
          // Out of budget for this run; stop rather than hammer.
          this.logger.warn('Clip grab: rate limited, ending run early');
          break;
        }
        if (!res.ok) continue;
        const data = await res.json();
        for (const clip of data.data || []) {
          collected.push({ clip, streamerId: s.id, name: s.name });
        }
      } catch {
        /* one streamer failing must not end the run */
      }
    }

    if (collected.length === 0) {
      this.logger.log(`Clip grab: ${streamers.length} streamers checked, no new clips`);
      return { checked: streamers.length, imported: 0 };
    }

    // Skip anything already stored — externalId is the Twitch clip slug.
    const ids = collected.map((c) => c.clip.id);
    const existing = await this.prisma.post.findMany({
      where: { externalId: { in: ids }, clipSource: 'TWITCH' },
      select: { externalId: true },
    });
    const seen = new Set(existing.map((e) => e.externalId));
    const fresh = collected.filter((c) => !seen.has(c.clip.id));
    if (fresh.length === 0) {
      this.logger.log(`Clip grab: ${streamers.length} checked, ${collected.length} found, all known`);
      return { checked: streamers.length, imported: 0 };
    }

    const gameTagIds = await this.resolveGameTags(fresh.map((f) => f.clip.game_id), token, clientId);

    let imported = 0;
    for (const { clip, streamerId, name } of fresh) {
      try {
        const tagId = gameTagIds.get(clip.game_id);
        await this.prisma.post.create({
          data: {
            title: clip.title?.trim() || `Clip — ${name}`,
            content: '',
            type: 'CLIP',
            videoUrl: clip.url,
            thumbnailUrl: clip.thumbnail_url,
            clipSource: 'TWITCH',
            externalId: clip.id,
            duration: Math.round(clip.duration),
            viewCount: clip.view_count,
            createdAt: new Date(clip.created_at),
            authorId: BOT_USER_ID,
            streamerProfileId: streamerId,
            isOfficial: true,
            // Tagging at creation is the whole point — an untagged clip is
            // invisible in Discover > Games.
            ...(tagId ? { tags: { create: [{ tagId }] } } : {}),
          },
        });
        imported++;
      } catch (err: any) {
        if (err.code !== 'P2002') {
          this.logger.warn(`Clip ${clip.id} failed: ${err.message}`);
        }
      }
    }

    if (imported > 0) {
      await this.redis.delPattern('feed:*');
      await this.redis.delPattern('posts:list:*');
    }

    this.logger.log(
      `Clip grab: ${streamers.length} streamers checked, ${collected.length} found, ${imported} imported`,
    );
    return { checked: streamers.length, imported };
  }

  /**
   * Map Twitch game ids to our GAME tag ids, creating tags as needed.
   *
   * Games are looked up in batches of 100 and the id→name mapping is cached,
   * because the same handful of titles dominates every run.
   */
  private async resolveGameTags(
    gameIds: string[],
    token: string,
    clientId: string,
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const unique = [...new Set(gameIds.filter(Boolean))];
    if (unique.length === 0) return out;

    const names = new Map<string, string>();
    const uncached: string[] = [];
    for (const id of unique) {
      const hit = await this.redis.get(`twitch:game:${id}`);
      if (hit) names.set(id, hit);
      else uncached.push(id);
    }

    for (let i = 0; i < uncached.length; i += 100) {
      const batch = uncached.slice(i, i + 100);
      const qs = batch.map((id) => `id=${encodeURIComponent(id)}`).join('&');
      try {
        const res = await fetch(`https://api.twitch.tv/helix/games?${qs}`, {
          headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` },
        });
        if (!res.ok) continue;
        const data = await res.json();
        for (const g of data.data || []) {
          if (!g.id || !g.name) continue;
          names.set(g.id, g.name);
          await this.redis.set(`twitch:game:${g.id}`, g.name, 30 * 86400);
        }
      } catch {
        /* leave these clips untagged rather than failing the run */
      }
    }

    for (const [gameId, gameName] of names) {
      const slug = this.toSlug(gameName);
      if (!slug) continue;
      try {
        const tag = await this.prisma.tag.upsert({
          where: { slug },
          create: { name: gameName.toLowerCase(), slug, type: 'GAME' },
          // Never downgrade a tag that a human classified as something else.
          update: {},
        });
        out.set(gameId, tag.id);
      } catch {
        /* ignore */
      }
    }

    return out;
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }
}
