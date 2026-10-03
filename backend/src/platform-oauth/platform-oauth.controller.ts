import {
  Controller, Get, Post, Delete, Param, Query, Req, Res,
  UseGuards, BadRequestException, Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PlatformOAuthService, PlatformName } from './platform-oauth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

const VALID_PLATFORMS: PlatformName[] = ['twitch', 'kick', 'youtube', 'tiktok', 'discord'];

@Controller('oauth')
export class PlatformOAuthController {
  private readonly logger = new Logger(PlatformOAuthController.name);

  constructor(
    private oauthService: PlatformOAuthService,
    private config: ConfigService,
    private redis: RedisService,
  ) {}

  /**
   * GET /api/oauth/:platform
   * Redirects user to platform's OAuth consent screen.
   * Optional ?action=link (with JWT) to link account vs login.
   */
  @Get(':platform')
  async startOAuth(
    @Param('platform') platform: string,
    @Query('action') action: string | undefined,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    if (!VALID_PLATFORMS.includes(platform as PlatformName)) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }

    // Generate CSRF state token
    const state = crypto.randomBytes(16).toString('hex');

    // Generate PKCE code_verifier/challenge for platforms that require it (Kick)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const stateData = JSON.stringify({ action: action || 'login', token: token || null, codeVerifier });
    await this.redis.set(`oauth:state:${state}`, stateData, 600); // 10min TTL

    const url = this.oauthService.getOAuthUrl(platform as PlatformName, state, codeChallenge);
    res.redirect(url);
  }

  /**
   * GET /api/oauth/:platform/callback
   * OAuth callback — exchanges code, logs in or links, redirects to frontend.
   */
  @Get(':platform/callback')
  async oauthCallback(
    @Param('platform') platform: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'https://xdtv.fans');

    if (error || !code) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${error || 'no_code'}`);
    }

    if (!VALID_PLATFORMS.includes(platform as PlatformName)) {
      return res.redirect(`${frontendUrl}/auth/callback?error=invalid_platform`);
    }

    // Validate CSRF state
    if (!state) {
      return res.redirect(`${frontendUrl}/auth/callback?error=missing_state`);
    }
    const stateRaw = await this.redis.get(`oauth:state:${state}`);
    if (!stateRaw) {
      return res.redirect(`${frontendUrl}/auth/callback?error=invalid_state`);
    }
    await this.redis.del(`oauth:state:${state}`);

    const stateData = JSON.parse(stateRaw);

    try {
      const profile = await this.oauthService.exchangeCode(platform as PlatformName, code, stateData.codeVerifier);

      if (stateData.action === 'link' && stateData.token) {
        // Link mode — validate JWT and link platform
        const jwt = require('jsonwebtoken');
        const secret = this.config.get('JWT_SECRET', 'change-me');
        const payload = jwt.verify(stateData.token, secret);
        await this.oauthService.linkPlatform(payload.userId, profile);
        return res.redirect(`${frontendUrl}/settings?linked=${platform}`);
      }

      // Login/register mode
      const result = await this.oauthService.loginOrRegister(profile);
      this.logger.log(
        `OAuth ${platform} login ok (new=${result.isNew}, user=${result.user.id})`,
      );
      return res.redirect(
        `${frontendUrl}/auth/callback?token=${result.token}&isNew=${result.isNew}`,
      );
    } catch (err) {
      // Previously this swallowed the cause and redirected with only the
      // message, so a production login failure left nothing in the logs to
      // diagnose — the reason a broken provider could go unnoticed.
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.error(
        `OAuth ${platform} callback failed (action=${stateData.action}): ${msg}`,
        err instanceof Error ? err.stack : undefined,
      );
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(msg)}`);
    }
  }

  /**
   * DELETE /api/oauth/:platform
   * Unlink a platform from current user. Requires JWT auth.
   */
  @Delete(':platform')
  @UseGuards(JwtAuthGuard)
  async unlinkPlatform(
    @Param('platform') platform: string,
    @Req() req,
  ) {
    if (!VALID_PLATFORMS.includes(platform as PlatformName)) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    return this.oauthService.unlinkPlatform(req.user.userId, platform as PlatformName);
  }

  /**
   * GET /api/oauth/platforms
   * Returns which platforms the current user has connected.
   */
  @Get('platforms/connected')
  @UseGuards(JwtAuthGuard)
  async getConnectedPlatforms(@Req() req) {
    return this.oauthService.getConnectedPlatforms(req.user.userId);
  }

  /**
   * POST /api/oauth/:platform/claim
   * Claim a streamer profile by matching platform ID.
   */
  @Post(':platform/claim')
  @UseGuards(JwtAuthGuard)
  async claimByPlatform(
    @Param('platform') platform: string,
    @Req() req,
  ) {
    if (!VALID_PLATFORMS.includes(platform as PlatformName)) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    return this.oauthService.claimByPlatform(req.user.userId, platform as PlatformName);
  }
}
