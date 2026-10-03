import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { FeedService } from '../feed/feed.service';

/**
 * Shared shape for streamer list rows, including the per-platform live stats
 * the LiveCard renders. Kept in one place so the viewer-ordered live path and
 * the general list path cannot drift apart.
 */
const LIVE_SELECT = {
  id: true, slug: true, name: true, avatarUrl: true, bannerUrl: true,
  bio: true, twitchUrl: true, youtubeUrl: true, kickUrl: true,
  isClaimed: true, isVerified: true, isLive: true, chatEnabled: true,
  viewCount: true, followerCount: true, userId: true, createdAt: true,
  _count: { select: { channels: true } },
  stats: {
    select: {
      platform: true,
      isLive: true,
      viewerCount: true,
      streamTitle: true,
      thumbnailUrl: true,
    },
  },
} as const;

/**
 * SQL that buckets a streamer name into a directory letter.
 *
 * Three cases, in order: names starting with a digit go to '0-9' (704 of
 * them — the reason the archive's index ran "from 0 to z"), names starting
 * with a Latin letter go to that letter with Polish diacritics folded so
 * Żaneta files under Z, and everything else goes to '#'. That last bucket is
 * not a rounding error here: 695 streamers have Cyrillic, Japanese or Thai
 * names that belong nowhere in a Latin alphabet.
 */
const LETTER_BUCKET_SQL = `
  CASE
    WHEN name ~ '^[0-9]' THEN '0-9'
    WHEN upper(translate(left(name,1),'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ','acelnoszzACELNOSZZ')) BETWEEN 'A' AND 'Z'
      THEN upper(translate(left(name,1),'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ','acelnoszzACELNOSZZ'))
    ELSE '#'
  END`;

/** Platform → column. Fixed map so the value is never request-controlled. */
const PLATFORM_COLUMN: Record<string, string> = {
  twitch: 'twitch_url',
  kick: 'kick_url',
  youtube: 'youtube_url',
  tiktok: 'tiktok_id',
};

@Injectable()
export class StreamersService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    @Optional() private feedService?: FeedService,
  ) {}

  async findAll(page: number, limit: number, search?: string, sort?: string, platform?: string, filter?: string, letter?: string) {
    const cacheKey = `streamers:list:${page}:${limit}:${search || ''}:${sort || ''}:${platform || ''}:${filter || ''}:${letter || ''}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    // Platform filter
    if (platform && platform !== 'all') {
      const platformMap: Record<string, string> = {
        twitch: 'twitchUrl',
        kick: 'kickUrl',
        youtube: 'youtubeUrl',
        tiktok: 'tiktokId',
      };
      const field = platformMap[platform.toLowerCase()];
      if (field) {
        where[field] = { not: null };
      }
    }

    // Status filter
    if (filter === 'live') {
      where.isLive = true;
    } else if (filter === 'new') {
      // Created in last 30 days
      where.createdAt = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }

    // Alphabetical bucket.
    //
    // Done entirely in SQL, paginated, rather than resolving the bucket to a
    // list of ids and handing that to Prisma: the letter P alone covers 4,050
    // streamers, and an IN clause of that size would be built and shipped on
    // every page view just to return 24 rows.
    if (letter) {
      const conds: string[] = [`(${LETTER_BUCKET_SQL}) = $1`];
      const params: any[] = [letter];

      if (search) {
        params.push(`%${search}%`);
        conds.push(`name ILIKE $${params.length}`);
      }
      if (platform && platform !== 'all') {
        // Column name comes from a fixed map, never from the request, so it
        // cannot be injected even though it is interpolated.
        const field = PLATFORM_COLUMN[platform.toLowerCase()];
        if (field) conds.push(`${field} IS NOT NULL`);
      }
      if (filter === 'live') conds.push('is_live = true');

      const whereSql = conds.join(' AND ');
      const orderSql =
        sort === 'new' ? 'created_at DESC'
        : sort === 'popular' ? 'is_live DESC, follower_count DESC'
        : 'name ASC';

      const [rows, countRows] = await Promise.all([
        this.prisma.$queryRawUnsafe<{ id: number }[]>(
          `SELECT id FROM streamer_profiles WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${skip}`,
          ...params,
        ),
        this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT count(*)::bigint AS count FROM streamer_profiles WHERE ${whereSql}`,
          ...params,
        ),
      ]);

      const ids = rows.map((r) => Number(r.id));
      const total = Number(countRows[0]?.count ?? 0);
      const hydrated = ids.length
        ? await this.prisma.streamerProfile.findMany({ where: { id: { in: ids } }, select: LIVE_SELECT })
        : [];

      // findMany does not preserve IN order — restore the alphabetical sort.
      const byId = new Map(hydrated.map((r) => [r.id, r] as const));
      const data = ids.map((id) => byId.get(id)).filter(Boolean);

      const letterResult = { data, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
      await this.redis.set(cacheKey, JSON.stringify(letterResult), 300);
      return letterResult;
    }

    // Live streamers ordered by actual concurrent viewers.
    //
    // `sort=viewers` previously ordered by StreamerProfile.viewCount, which is
    // a cumulative profile-page counter and has nothing to do with how many
    // people are watching right now — so "Live, most viewers" returned an
    // effectively arbitrary order. Real viewer counts live in StreamerStats,
    // one row per platform, which Prisma cannot order a parent by. Resolve the
    // ordering in SQL first, then hydrate.
    if (filter === 'live' && sort === 'viewers') {
      const ordered = await this.prisma.$queryRaw<{ id: number }[]>`
        SELECT sp.id
        FROM streamer_profiles sp
        JOIN LATERAL (
          SELECT COALESCE(MAX(ss.viewer_count), 0) AS viewers
          FROM streamer_stats ss
          WHERE ss.streamer_profile_id = sp.id AND ss.is_live = true
        ) v ON true
        WHERE sp.is_live = true
        ORDER BY v.viewers DESC, sp.follower_count DESC
        LIMIT ${limit} OFFSET ${skip}
      `;

      const ids = ordered.map((r) => Number(r.id));
      const [rows, total] = await Promise.all([
        ids.length
          ? this.prisma.streamerProfile.findMany({
              where: { id: { in: ids } },
              select: LIVE_SELECT,
            })
          : Promise.resolve([]),
        this.prisma.streamerProfile.count({ where: { isLive: true } }),
      ]);

      // findMany does not preserve the IN order — restore the ranking.
      const byId = new Map(rows.map((r) => [r.id, r] as const));
      const data = ids.map((id) => byId.get(id)).filter(Boolean);

      const liveResult = { data, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
      await this.redis.set(cacheKey, JSON.stringify(liveResult), 60);
      return liveResult;
    }

    // Sort order
    let orderBy: any;
    switch (sort) {
      case 'viewers':
        orderBy = { viewCount: 'desc' };
        break;
      case 'new':
        orderBy = { createdAt: 'desc' };
        break;
      case 'name':
        orderBy = { name: 'asc' };
        break;
      default: // 'popular' or undefined
        orderBy = [{ isLive: 'desc' }, { followerCount: 'desc' }];
        break;
    }

    const [profiles, total] = await Promise.all([
      this.prisma.streamerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true, slug: true, name: true, avatarUrl: true, bannerUrl: true,
          bio: true, twitchUrl: true, youtubeUrl: true, kickUrl: true,
          isClaimed: true, isVerified: true, isLive: true, chatEnabled: true,
          viewCount: true, followerCount: true, userId: true,
          createdAt: true,
          _count: { select: { channels: true } },
          // Per-platform live data. LiveCard needs the stream title, viewer
          // count and preview thumbnail, none of which exist on the profile
          // itself — `viewCount` here is a profile-view counter, not viewers.
          //
          // Gated on page size for the same reason as chatActivity below: the
          // streamer picker requests limit=5000 and has no use for stats.
          ...(limit <= 100 && {
            stats: {
              select: {
                platform: true,
                isLive: true,
                viewerCount: true,
                streamTitle: true,
                thumbnailUrl: true,
              },
            },
          }),
        },
      }),
      this.prisma.streamerProfile.count({ where }),
    ]);

    // Get chat activity (message count in last 24h) per streamer — skip for large batch requests
    const streamerIds = profiles.map((p) => p.id);
    const chatActivity: Record<number, number> = {};
    if (limit <= 100 && streamerIds.length > 0) {
      const groups = await this.prisma.message.groupBy({
        by: ['channelId'],
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          isDeleted: false,
          channel: { streamerProfileId: { in: streamerIds } },
        },
        _count: true,
      });
      const channels = await this.prisma.channel.findMany({
        where: { id: { in: groups.map((g) => g.channelId) } },
        select: { id: true, streamerProfileId: true },
      });
      const channelToStreamer = new Map(channels.map((c) => [c.id, c.streamerProfileId]));
      for (const g of groups) {
        const sid = channelToStreamer.get(g.channelId);
        if (sid) chatActivity[sid] = (chatActivity[sid] || 0) + g._count;
      }
    }

    const enriched = profiles.map((p) => ({
      ...p,
      chatMessagesLast24h: chatActivity[p.id] || 0,
    }));

    const result = { data: enriched, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
    await this.redis.set(cacheKey, JSON.stringify(result), 120);
    return result;
  }

  /**
   * Counts for the directory index: how many streamers sit under each letter
   * and on each platform.
   *
   * One query per dimension rather than one per letter — 27 separate counts
   * would be 27 round trips to render a single row of buttons. Letters with
   * no streamers are still returned (as absent keys) so the UI can disable
   * them instead of offering an empty page.
   */
  /**
   * Name typeahead.
   *
   * Ranked so exact and prefix matches come first — searching "kacper" should
   * offer kacper before xXkacperXx. Postgres cannot express that ordering in a
   * Prisma `contains`, so the rank is computed in SQL.
   */
  async suggest(q: string, limit = 8) {
    const query = (q || '').trim();
    if (query.length < 2) return [];

    const cacheKey = `streamers:suggest:${query.toLowerCase()}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const rows = await this.prisma.$queryRaw<
      { id: number; slug: string; name: string; avatar_url: string | null; is_live: boolean; follower_count: number }[]
    >`
      SELECT id, slug, name, avatar_url, is_live, follower_count
      FROM streamer_profiles
      WHERE name ILIKE ${'%' + query + '%'} OR slug ILIKE ${'%' + query + '%'}
      ORDER BY
        CASE
          WHEN lower(name) = lower(${query}) THEN 0
          WHEN lower(name) LIKE lower(${query + '%'}) THEN 1
          ELSE 2
        END,
        is_live DESC,
        follower_count DESC
      LIMIT ${limit}
    `;

    const result = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      avatarUrl: r.avatar_url,
      isLive: r.is_live,
      followerCount: r.follower_count,
    }));

    await this.redis.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  async getDirectoryMeta() {
    const cacheKey = 'streamers:directory-meta';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [letterRows, platformRows, total] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ bucket: string; count: bigint }[]>(
        `SELECT (${LETTER_BUCKET_SQL}) AS bucket, count(*)::bigint AS count
         FROM streamer_profiles GROUP BY 1`,
      ),
      this.prisma.$queryRawUnsafe<{ platform: string; count: bigint }[]>(
        `SELECT 'twitch' AS platform, count(*)::bigint FROM streamer_profiles WHERE twitch_url IS NOT NULL
         UNION ALL SELECT 'kick', count(*)::bigint FROM streamer_profiles WHERE kick_url IS NOT NULL
         UNION ALL SELECT 'youtube', count(*)::bigint FROM streamer_profiles WHERE youtube_url IS NOT NULL
         UNION ALL SELECT 'tiktok', count(*)::bigint FROM streamer_profiles WHERE tiktok_id IS NOT NULL`,
      ),
      this.prisma.streamerProfile.count(),
    ]);

    const letters: Record<string, number> = {};
    for (const r of letterRows) letters[r.bucket] = Number(r.count);

    const platforms: Record<string, number> = {};
    for (const r of platformRows) platforms[r.platform] = Number(r.count);

    const result = { letters, platforms, total };
    await this.redis.set(cacheKey, JSON.stringify(result), 600);
    return result;
  }

  async findBySlug(slug: string, userId: number | null = null) {
    const cacheKey = `streamers:slug:${slug}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const profile = JSON.parse(cached);
      this.prisma.streamerProfile.update({ where: { id: profile.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
      if (userId && this.feedService) {
        this.feedService.trackViewedStreamer(userId, profile.id).catch(() => {});
      }
      return profile;
    }

    const profile = await this.prisma.streamerProfile.findUnique({
      where: { slug },
      include: {
        _count: { select: { follows: true, posts: true } },
        stats: true,
      },
    });
    if (!profile) throw new NotFoundException('Streamer not found');
    this.prisma.streamerProfile.update({
      where: { id: profile.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});
    if (userId && this.feedService) {
      this.feedService.trackViewedStreamer(userId, profile.id).catch(() => {});
    }
    await this.redis.set(cacheKey, JSON.stringify(profile), 300);
    return profile;
  }

  /**
   * Take ownership of a streamer profile.
   *
   * Until now this asked for nothing but a login. Any authenticated user
   * could POST an id and walk away owning any of the thirty thousand
   * unclaimed profiles, complete with the STREAMER role — someone else's
   * channel, someone else's audience, and the dashboard that edits both.
   *
   * Ownership is now proved the only way it can be proved from here: the
   * caller must have connected the very platform account the profile was
   * scraped from. Twitch and Kick hand us a numeric account id during
   * OAuth; if the one on the user matches the one on the profile, the same
   * person is on both ends. Nothing else counts — matching names, matching
   * e-mails and matching avatars are all things an impostor can arrange.
   */
  async claim(id: number, userId: number) {
    const profile = await this.prisma.streamerProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Profile not found');
    if (profile.isClaimed) throw new ConflictException('Profile already claimed');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        twitchId: true, kickId: true, youtubeId: true, tiktokId: true,
        streamerProfile: { select: { id: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.streamerProfile) {
      throw new ConflictException('Masz już przypisany profil streamera');
    }

    const PLATFORMS = ['twitch', 'kick', 'youtube', 'tiktok'] as const;
    const matched = PLATFORMS.find((name) => {
      const key = `${name}Id` as const;
      const mine = (user as Record<string, unknown>)[key];
      const theirs = (profile as unknown as Record<string, unknown>)[key];
      return Boolean(mine) && mine === theirs;
    });

    if (!matched) {
      const linked = PLATFORMS.filter((n) => (user as Record<string, unknown>)[`${n}Id`]);
      throw new ForbiddenException(
        linked.length
          ? 'Połączone konta nie pasują do tego profilu. Przejąć kanał może tylko jego właściciel.'
          : 'Połącz najpierw konto Twitch lub Kick, którym nadajesz na tym kanale.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role: 'STREAMER' },
      });
      const claimed = await tx.streamerProfile.update({
        where: { id },
        data: { userId, isClaimed: true },
      });
      await this.redis.delPattern('streamers:*');
      return claimed;
    });
  }

  async update(id: number, userId: number, userRole: string, data: any) {
    const profile = await this.prisma.streamerProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Profile not found');
    if (profile.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException();
    }
    const { name, bio, avatarUrl, bannerUrl, twitchUrl, youtubeUrl, kickUrl, twitterUrl, chatEnabled } = data;
    const updated = await this.prisma.streamerProfile.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(bannerUrl !== undefined && { bannerUrl }),
        ...(twitchUrl !== undefined && { twitchUrl }),
        ...(youtubeUrl !== undefined && { youtubeUrl }),
        ...(kickUrl !== undefined && { kickUrl }),
        ...(twitterUrl !== undefined && { twitterUrl }),
        ...(chatEnabled !== undefined && { chatEnabled: !!chatEnabled }),
      },
    });
    await this.redis.delPattern('streamers:*');
    return updated;
  }

  async create(data: any) {
    if (!data.name || !data.slug) {
      throw new BadRequestException('Name and slug are required');
    }
    return this.prisma.streamerProfile.create({ data });
  }

  async getDashboard(userId: number) {
    const profile = await this.prisma.streamerProfile.findFirst({
      where: { userId },
      include: {
        channels: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
        _count: { select: { follows: true, posts: true, channels: { where: { isActive: true } } } },
        stats: true,
      },
    });
    if (!profile) throw new NotFoundException('No streamer profile linked to this account');

    const messagesLast24h = await this.prisma.message.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        isDeleted: false,
        channel: { streamerProfileId: profile.id },
      },
    });

    const messagesTotal = await this.prisma.message.count({
      where: {
        isDeleted: false,
        channel: { streamerProfileId: profile.id },
      },
    });

    return {
      ...profile,
      platformStats: profile.stats.map(s => ({
        platform: s.platform.toLowerCase(),
        followers: s.followers,
        isLive: s.isLive,
        streamTitle: s.streamTitle,
        viewerCount: s.viewerCount,
      })),
      stats: {
        followers: profile._count.follows,
        posts: profile._count.posts,
        channels: profile._count.channels,
        views: profile.viewCount,
        messagesLast24h,
        messagesTotal,
      },
    };
  }

  // ─── PLATFORM STATS ─────────────────────────────────────

  async getStatsBySlug(slug: string) {
    const cacheKey = `streamers:stats:${slug}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const profile = await this.prisma.streamerProfile.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        isLive: true,
        followerCount: true,
        twitchId: true,
        kickId: true,
        youtubeId: true,
        tiktokId: true,
        stats: true,
      },
    });
    if (!profile) throw new NotFoundException('Streamer not found');

    const platforms = profile.stats.map(s => ({
      platform: s.platform.toLowerCase(),
      followers: s.followers,
      isLive: s.isLive,
      streamTitle: s.streamTitle,
      viewerCount: s.viewerCount,
      thumbnailUrl: s.thumbnailUrl,
      updatedAt: s.updatedAt,
    }));

    const result = {
      slug: profile.slug,
      name: profile.name,
      isLive: profile.isLive,
      totalFollowers: profile.followerCount,
      connectedPlatforms: {
        twitch: !!profile.twitchId,
        kick: !!profile.kickId,
        youtube: !!profile.youtubeId,
        tiktok: !!profile.tiktokId,
      },
      platforms,
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 60);
    return result;
  }
}
