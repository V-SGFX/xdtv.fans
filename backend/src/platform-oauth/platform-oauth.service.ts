import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type PlatformName = 'twitch' | 'kick' | 'youtube' | 'tiktok' | 'discord';

export interface PlatformProfile {
  platform: PlatformName;
  platformId: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
}

/**
 * Maps platform name → User column for platform ID
 */
const USER_PLATFORM_FIELD: Record<PlatformName, string> = {
  twitch: 'twitchId',
  kick: 'kickId',
  youtube: 'youtubeId',
  tiktok: 'tiktokId',
  discord: 'discordId',
};

/**
 * Maps platform name → StreamerProfile column for platform ID
 */
const STREAMER_PLATFORM_FIELD: Record<string, string> = {
  twitch: 'twitchId',
  kick: 'kickId',
  youtube: 'youtubeId',
  tiktok: 'tiktokId',
};

@Injectable()
export class PlatformOAuthService {
  private readonly logger = new Logger(PlatformOAuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private redis: RedisService,
  ) {}

  // ═══════════════════════════════════════════════════════
  //  OAuth Login / Register — called after OAuth callback
  // ═══════════════════════════════════════════════════════

  /**
   * Handles the full OAuth flow:
   * 1. Find existing user by platform ID → login
   * 2. No user → create new account, optionally match streamer profile
   * 3. Return JWT token
   */
  async loginOrRegister(profile: PlatformProfile) {
    const field = USER_PLATFORM_FIELD[profile.platform];

    // 1. Existing user with this platform ID?
    const existing = await this.prisma.user.findFirst({
      where: { [field]: profile.platformId },
    });

    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { lastActiveAt: new Date() },
      });
      const token = this.jwt.sign({ userId: existing.id, role: existing.role });
      return {
        user: {
          id: existing.id,
          email: existing.email,
          username: existing.username,
          displayName: existing.displayName,
          avatarUrl: existing.avatarUrl,
          role: existing.role,
        },
        token,
        isNew: false,
      };
    }

    // 2. Create new user
    const username = await this.generateUniqueUsername(profile.username, profile.platform);
    const user = await this.prisma.user.create({
      data: {
        email: profile.email || `${profile.platform}_${profile.platformId}@oauth.xdtv.fans`,
        username,
        passwordHash: null,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        [field]: profile.platformId,
      },
    });

    // 3. Auto-match streamer profile by platform ID (not applicable for discord)
    //
    // The lookup deliberately does NOT filter on isClaimed. It used to, which
    // meant a platform ID belonging to an already-claimed profile fell through
    // to the auto-create branch below and tried to insert a second profile with
    // the same twitchId/kickId/youtubeId — all of which are @unique. The insert
    // threw, the whole callback failed, and the user simply could not log in.
    // With 29,292 profiles carrying a twitchId this grows as streamers claim
    // theirs, so the match is by platform ID and the claim state decides what
    // to do rather than whether we look at all.
    const streamerField = STREAMER_PLATFORM_FIELD[profile.platform];
    if (streamerField) {
      const existingProfile = await this.prisma.streamerProfile.findFirst({
        where: { [streamerField]: profile.platformId },
      });

      // Already claimed by somebody else — leave it alone. Logging in must
      // still succeed; they just do not get that profile.
      if (existingProfile?.isClaimed && existingProfile.userId && existingProfile.userId !== user.id) {
        this.logger.warn(
          `OAuth ${profile.platform}: profile ${existingProfile.slug} is already claimed by user ${existingProfile.userId}; skipping auto-claim for new user ${user.id}`,
        );
      }

      const matchedProfile =
        existingProfile && (!existingProfile.isClaimed || !existingProfile.userId)
          ? existingProfile
          : null;

      if (matchedProfile) {
        await this.prisma.$transaction([
          this.prisma.streamerProfile.update({
            where: { id: matchedProfile.id },
            data: { userId: user.id, isClaimed: true },
          }),
          this.prisma.user.update({
            where: { id: user.id },
            data: { role: 'STREAMER' },
          }),
        ]);
        user.role = 'STREAMER' as any;
        await this.redis.delPattern('streamers:*');
      } else if (!existingProfile) {
        // Only when no profile carries this platform ID at all. Creating one
        // while a claimed profile holds the same id violates the unique
        // constraint and fails the entire login.
        const platformUrl = this.buildPlatformUrl(profile.platform, profile.username);
        const slug = await this.generateUniqueSlug(profile.username);
        const newProfile = await this.prisma.streamerProfile.create({
          data: {
            slug,
            name: profile.displayName || profile.username,
            avatarUrl: profile.avatarUrl,
            [streamerField]: profile.platformId,
            ...(platformUrl ? { [`${profile.platform}Url`]: platformUrl } : {}),
            userId: user.id,
            isClaimed: true,
            isVerified: false,
            isLive: false,
            chatEnabled: false,
            viewCount: 0,
            followerCount: 0,
          },
        });
        await this.prisma.user.update({
          where: { id: user.id },
          data: { role: 'STREAMER' },
        });
        user.role = 'STREAMER' as any;
        await this.redis.delPattern('streamers:*');
        this.logger.log(`Auto-created StreamerProfile "${newProfile.name}" (id=${newProfile.id}) for user ${user.id} via ${profile.platform}`);
      }
    }

    const token = this.jwt.sign({ userId: user.id, role: user.role });
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      token,
      isNew: true,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  Link — connect platform to existing logged-in user
  // ═══════════════════════════════════════════════════════

  async linkPlatform(userId: number, profile: PlatformProfile) {
    const field = USER_PLATFORM_FIELD[profile.platform];

    // Check if another user already has this platform ID
    const conflict = await this.prisma.user.findFirst({
      where: { [field]: profile.platformId, NOT: { id: userId } },
    });
    if (conflict) {
      throw new ConflictException(`This ${profile.platform} account is already linked to another user`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        [field]: profile.platformId,
        // Optionally update avatar if user doesn't have one
        ...(profile.avatarUrl && !(await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } }))?.avatarUrl
          ? { avatarUrl: profile.avatarUrl }
          : {}),
      },
    });

    // Auto-claim: if there's an unclaimed StreamerProfile matching this platform ID, claim it
    const streamerField = STREAMER_PLATFORM_FIELD[profile.platform];
    if (streamerField) {
      const existingProfile = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { streamerProfile: { select: { id: true } } },
      });
      if (!existingProfile?.streamerProfile) {
        const unclaimed = await this.prisma.streamerProfile.findFirst({
          where: { [streamerField]: profile.platformId, isClaimed: false },
        });
        if (unclaimed) {
          await this.prisma.streamerProfile.update({
            where: { id: unclaimed.id },
            data: { isClaimed: true, userId },
          });
          await this.prisma.user.update({
            where: { id: userId },
            data: { role: 'STREAMER' },
          });
          await this.redis.delPattern('streamers:*');
          this.logger.log(`Auto-claimed profile "${unclaimed.name}" for user ${userId} via ${profile.platform} link`);
        } else {
          // No existing profile — auto-create one
          const platformUrl = this.buildPlatformUrl(profile.platform, profile.username);
          const slug = await this.generateUniqueSlug(profile.username);
          const newProfile = await this.prisma.streamerProfile.create({
            data: {
              slug,
              name: profile.displayName || profile.username,
              avatarUrl: profile.avatarUrl,
              [streamerField]: profile.platformId,
              ...(platformUrl ? { [`${profile.platform}Url`]: platformUrl } : {}),
              userId,
              isClaimed: true,
              isVerified: false,
              isLive: false,
              chatEnabled: false,
              viewCount: 0,
              followerCount: 0,
            },
          });
          await this.prisma.user.update({
            where: { id: userId },
            data: { role: 'STREAMER' },
          });
          await this.redis.delPattern('streamers:*');
          this.logger.log(`Auto-created StreamerProfile "${newProfile.name}" (id=${newProfile.id}) for user ${userId} via ${profile.platform} link`);
        }
      }
    }

    return { linked: true, platform: profile.platform };
  }

  // ═══════════════════════════════════════════════════════
  //  Unlink — remove platform from user
  // ═══════════════════════════════════════════════════════

  async unlinkPlatform(userId: number, platform: PlatformName) {
    const field = USER_PLATFORM_FIELD[platform];

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, twitchId: true, kickId: true, youtubeId: true, tiktokId: true, discordId: true },
    });
    if (!user) throw new UnauthorizedException();

    // Ensure user has at least one other login method (password or another platform)
    const linkedPlatforms = [user.twitchId, user.kickId, user.youtubeId, user.tiktokId, user.discordId].filter(Boolean).length;
    if (!user.passwordHash && linkedPlatforms <= 1) {
      throw new BadRequestException('Cannot unlink last login method. Set a password first.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { [field]: null },
    });

    return { unlinked: true, platform };
  }

  // ═══════════════════════════════════════════════════════
  //  Claim — match user's platform ID to streamer profile
  // ═══════════════════════════════════════════════════════

  async claimByPlatform(userId: number, platform: PlatformName) {
    const userField = USER_PLATFORM_FIELD[platform];
    const streamerField = STREAMER_PLATFORM_FIELD[platform];

    if (!streamerField) {
      throw new BadRequestException(`Cannot claim streamer profile via ${platform}`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, [userField]: true, streamerProfile: true },
    });
    if (!user) throw new UnauthorizedException();

    const platformId = (user as any)[userField];
    if (!platformId) {
      throw new BadRequestException(`Link your ${platform} account first`);
    }

    if ((user as any).streamerProfile) {
      throw new ConflictException('You already have a streamer profile');
    }

    const profile = await this.prisma.streamerProfile.findFirst({
      where: { [streamerField]: platformId },
    });
    if (!profile) {
      throw new BadRequestException(`No streamer profile found matching your ${platform} account`);
    }
    if (profile.isClaimed) {
      throw new ConflictException('This streamer profile is already claimed');
    }

    await this.prisma.$transaction([
      this.prisma.streamerProfile.update({
        where: { id: profile.id },
        data: { userId, isClaimed: true },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role: 'STREAMER' },
      }),
    ]);
    await this.redis.delPattern('streamers:*');

    return { claimed: true, streamerProfileId: profile.id, slug: profile.slug };
  }

  // ═══════════════════════════════════════════════════════
  //  Connected platforms for dashboard
  // ═══════════════════════════════════════════════════════

  async getConnectedPlatforms(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        twitchId: true,
        kickId: true,
        youtubeId: true,
        tiktokId: true,
        discordId: true,
        passwordHash: true,
      },
    });
    if (!user) throw new UnauthorizedException();

    return {
      twitch: !!user.twitchId,
      kick: !!user.kickId,
      youtube: !!user.youtubeId,
      tiktok: !!user.tiktokId,
      discord: !!user.discordId,
      hasPassword: !!user.passwordHash,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  Utils
  // ═══════════════════════════════════════════════════════

  private async generateUniqueUsername(base: string, platform: string): Promise<string> {
    // Sanitize: only alphanumeric and underscores
    let slug = base.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
    if (!slug) slug = platform;

    const exists = await this.prisma.user.findUnique({ where: { username: slug } });
    if (!exists) return slug;

    // Append random suffix
    for (let i = 0; i < 10; i++) {
      const candidate = `${slug}_${Math.random().toString(36).slice(2, 6)}`;
      const taken = await this.prisma.user.findUnique({ where: { username: candidate } });
      if (!taken) return candidate;
    }
    return `${slug}_${Date.now().toString(36)}`;
  }

  private async generateUniqueSlug(base: string): Promise<string> {
    let slug = base.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 30);
    if (!slug) slug = 'streamer';

    const exists = await this.prisma.streamerProfile.findFirst({ where: { slug } });
    if (!exists) return slug;

    for (let i = 0; i < 10; i++) {
      const candidate = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      const taken = await this.prisma.streamerProfile.findFirst({ where: { slug: candidate } });
      if (!taken) return candidate;
    }
    return `${slug}-${Date.now().toString(36)}`;
  }

  private buildPlatformUrl(platform: PlatformName, username: string): string | null {
    switch (platform) {
      case 'twitch': return `https://twitch.tv/${username}`;
      case 'kick': return `https://kick.com/${username}`;
      case 'youtube': return `https://youtube.com/@${username}`;
      case 'tiktok': return `https://tiktok.com/@${username}`;
      default: return null;
    }
  }

  /**
   * Build OAuth redirect URL for a platform.
   * Client calls GET /api/oauth/:platform and gets redirected.
   */
  getOAuthUrl(platform: PlatformName, state: string, codeChallenge?: string): string {
    const base = this.config.get('APP_URL', 'https://xdtv.fans');

    switch (platform) {
      case 'twitch': {
        const clientId = this.config.get('TWITCH_CLIENT_ID', '');
        return `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(`${base}/api/oauth/twitch/callback`)}&response_type=code&scope=user:read:email&state=${state}`;
      }
      case 'youtube': {
        const clientId = this.config.get('GOOGLE_CLIENT_ID', '');
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(`${base}/api/oauth/youtube/callback`)}&response_type=code&scope=${encodeURIComponent('openid email profile https://www.googleapis.com/auth/youtube.readonly')}&state=${state}&access_type=offline`;
      }
      case 'kick': {
        // Kick OAuth 2.1 with PKCE — https://docs.kick.com/getting-started/generating-tokens-oauth2-flow
        const clientId = this.config.get('KICK_CLIENT_ID', '');
        return `https://id.kick.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(`${base}/api/oauth/kick/callback`)}&scope=user:read&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
      }
      case 'tiktok': {
        const clientKey = this.config.get('TIKTOK_CLIENT_KEY', '');
        return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&redirect_uri=${encodeURIComponent(`${base}/api/oauth/tiktok/callback`)}&response_type=code&scope=user.info.basic&state=${state}`;
      }
      case 'discord': {
        const clientId = this.config.get('DISCORD_CLIENT_ID', '');
        return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(`${base}/api/oauth/discord/callback`)}&response_type=code&scope=identify%20email&state=${state}`;
      }
    }
  }

  /**
   * Exchange authorization code for platform profile data.
   */
  async exchangeCode(platform: PlatformName, code: string, codeVerifier?: string): Promise<PlatformProfile> {
    const base = this.config.get('APP_URL', 'https://xdtv.fans');

    switch (platform) {
      case 'twitch':
        return this.exchangeTwitch(code, `${base}/api/oauth/twitch/callback`);
      case 'youtube':
        return this.exchangeYouTube(code, `${base}/api/oauth/youtube/callback`);
      case 'kick':
        return this.exchangeKick(code, `${base}/api/oauth/kick/callback`, codeVerifier);
      case 'tiktok':
        return this.exchangeTikTok(code, `${base}/api/oauth/tiktok/callback`);
      case 'discord':
        return this.exchangeDiscord(code, `${base}/api/oauth/discord/callback`);
      default:
        throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
  }

  // ─── Twitch ───────────────────────────────────────────

  private async exchangeTwitch(code: string, redirectUri: string): Promise<PlatformProfile> {
    const clientId = this.config.get('TWITCH_CLIENT_ID');
    const clientSecret = this.config.get('TWITCH_CLIENT_SECRET');

    // Exchange code for token
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      this.logger.error('Twitch token exchange failed', tokenData);
      throw new BadRequestException('Twitch authentication failed');
    }

    // Get user info
    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Client-Id': clientId,
      },
    });
    const userData = await userRes.json();
    const user = userData.data?.[0];
    if (!user) throw new BadRequestException('Failed to fetch Twitch profile');

    return {
      platform: 'twitch',
      platformId: user.id,
      username: user.login,
      displayName: user.display_name,
      email: user.email,
      avatarUrl: user.profile_image_url,
    };
  }

  // ─── YouTube (Google) ─────────────────────────────────

  private async exchangeYouTube(code: string, redirectUri: string): Promise<PlatformProfile> {
    const clientId = this.config.get('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get('GOOGLE_CLIENT_SECRET');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      this.logger.error('Google token exchange failed', tokenData);
      throw new BadRequestException('Google authentication failed');
    }

    // Get YouTube channel info
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );
    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];

    if (channel) {
      return {
        platform: 'youtube',
        platformId: channel.id,
        username: channel.snippet.customUrl?.replace('@', '') || channel.id,
        displayName: channel.snippet.title,
        email: undefined, // YouTube doesn't expose email via channel API
        avatarUrl: channel.snippet.thumbnails?.default?.url,
      };
    }

    // Fallback: get Google user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();
    return {
      platform: 'youtube',
      platformId: user.id,
      username: user.name || user.id,
      displayName: user.name,
      email: user.email,
      avatarUrl: user.picture,
    };
  }

  // ─── Kick ─────────────────────────────────────────────

  private async exchangeKick(code: string, redirectUri: string, codeVerifier?: string): Promise<PlatformProfile> {
    const clientId = this.config.get('KICK_CLIENT_ID');
    const clientSecret = this.config.get('KICK_CLIENT_SECRET');

    // Kick OAuth 2.1 — token endpoint at id.kick.com, requires PKCE code_verifier
    const body: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    };
    if (codeVerifier) body.code_verifier = codeVerifier;

    const tokenRes = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      this.logger.error('Kick token exchange failed', tokenData);
      throw new BadRequestException('Kick authentication failed');
    }

    // Kick public API v1 — https://docs.kick.com/apis/users
    const userRes = await fetch('https://api.kick.com/public/v1/users', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();
    const user = userData.data?.[0];
    if (!user) {
      this.logger.error('Kick user fetch failed', userData);
      throw new BadRequestException('Failed to fetch Kick user profile');
    }

    return {
      platform: 'kick',
      platformId: String(user.user_id),
      username: user.name,
      displayName: user.name,
      email: user.email,
      avatarUrl: user.profile_picture,
    };
  }

  // ─── TikTok ───────────────────────────────────────────

  private async exchangeTikTok(code: string, redirectUri: string): Promise<PlatformProfile> {
    const clientKey = this.config.get('TIKTOK_CLIENT_KEY');
    const clientSecret = this.config.get('TIKTOK_CLIENT_SECRET');

    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.data?.access_token) {
      this.logger.error('TikTok token exchange failed', tokenData);
      throw new BadRequestException('TikTok authentication failed');
    }

    const userRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username',
      {
        headers: { Authorization: `Bearer ${tokenData.data.access_token}` },
      },
    );
    const userData = await userRes.json();
    const user = userData.data?.user;
    if (!user) throw new BadRequestException('Failed to fetch TikTok profile');

    return {
      platform: 'tiktok',
      platformId: user.open_id,
      username: user.username || user.open_id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    };
  }

  // ─── Discord ──────────────────────────────────────────

  private async exchangeDiscord(code: string, redirectUri: string): Promise<PlatformProfile> {
    const clientId = this.config.get('DISCORD_CLIENT_ID');
    const clientSecret = this.config.get('DISCORD_CLIENT_SECRET');

    const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      this.logger.error('Discord token exchange failed', tokenData);
      throw new BadRequestException('Discord authentication failed');
    }

    const userRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();
    if (!user.id) throw new BadRequestException('Failed to fetch Discord profile');

    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % 6n}.png`;

    return {
      platform: 'discord',
      platformId: user.id,
      username: user.username,
      displayName: user.global_name || user.username,
      email: user.email,
      avatarUrl,
    };
  }
}
