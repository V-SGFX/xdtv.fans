/**
 * Import Twitch clips for top N streamers (by follower count).
 *
 * Usage:  npx tsx scripts/import-twitch-clips.ts [streamerCount] [clipsPerStreamer]
 *   defaults: 500 streamers, 5 clips each
 *
 * Twitch Clips API: GET /helix/clips?broadcaster_id=&first=&started_at=
 * Rate limit: 800 requests / minute (app token).
 */

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID!;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!;
const BOT_USER_ID = 4; // xdtv_mapet user

const STREAMER_COUNT = parseInt(process.argv[2] || '500', 10);
const CLIPS_PER_STREAMER = parseInt(process.argv[3] || '5', 10);

let appToken = '';

async function getAppToken(): Promise<string> {
  if (appToken) return appToken;

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get Twitch token: ' + JSON.stringify(data));
  appToken = data.access_token;
  return appToken;
}

interface TwitchClip {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_name: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  vod_offset: number | null;
  game_id: string;
}

async function fetchClips(broadcasterId: string, count: number): Promise<TwitchClip[]> {
  const token = await getAppToken();

  // Fetch popular clips from the last year
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const url = new URL('https://api.twitch.tv/helix/clips');
  url.searchParams.set('broadcaster_id', broadcasterId);
  url.searchParams.set('first', String(Math.min(count, 20)));
  url.searchParams.set('started_at', oneYearAgo.toISOString());

  const res = await fetch(url.toString(), {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Ratelimit-Reset') || '5', 10);
    const waitMs = Math.max((retryAfter - Math.floor(Date.now() / 1000)) * 1000, 2000);
    console.log(`  ⏳ Rate limited, waiting ${Math.ceil(waitMs / 1000)}s...`);
    await sleep(waitMs);
    return fetchClips(broadcasterId, count);
  }

  if (!res.ok) {
    console.warn(`  ⚠️  Clips API error ${res.status} for broadcaster ${broadcasterId}`);
    return [];
  }

  const data = await res.json();
  return data.data || [];
}

function clipToEmbedUrl(clip: TwitchClip): string {
  // Twitch clip embed: https://clips.twitch.tv/embed?clip=SLUG&parent=xdtv.fans
  return `https://clips.twitch.tv/embed?clip=${clip.id}&parent=xdtv.fans`;
}

function clipToVideoUrl(clip: TwitchClip): string {
  // Direct clip URL for the player
  return clip.url;
}

function clipThumbnail(clip: TwitchClip): string {
  // Twitch provides a high-quality thumbnail
  return clip.thumbnail_url;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`🎬 Importing Twitch clips for top ${STREAMER_COUNT} streamers (${CLIPS_PER_STREAMER} clips each)`);
  console.log('');

  // Get top streamers by follower count that have a twitchId
  const streamers = await prisma.streamerProfile.findMany({
    where: { twitchId: { not: null } },
    orderBy: { followerCount: 'desc' },
    take: STREAMER_COUNT,
    select: { id: true, name: true, twitchId: true, followerCount: true },
  });

  console.log(`📋 Found ${streamers.length} streamers with twitchId`);

  // Get existing clip externalIds to avoid duplicates
  const existingClips = await prisma.post.findMany({
    where: { type: 'CLIP', clipSource: 'TWITCH', externalId: { not: null } },
    select: { externalId: true },
  });
  const existingIds = new Set(existingClips.map((c) => c.externalId));
  console.log(`📦 ${existingIds.size} existing Twitch clips in DB`);
  console.log('');

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let streamersProcessed = 0;
  let streamersWithClips = 0;

  for (const streamer of streamers) {
    streamersProcessed++;
    const prefix = `[${streamersProcessed}/${streamers.length}] ${streamer.name}`;

    try {
      const clips = await fetchClips(streamer.twitchId!, CLIPS_PER_STREAMER);

      if (clips.length === 0) {
        // Don't spam for streamers without clips
        continue;
      }

      let imported = 0;
      let skipped = 0;

      for (const clip of clips) {
        if (existingIds.has(clip.id)) {
          skipped++;
          continue;
        }

        try {
          await prisma.post.create({
            data: {
              title: clip.title || `Clip - ${streamer.name}`,
              content: '',
              type: 'CLIP',
              videoUrl: clipToVideoUrl(clip),
              thumbnailUrl: clipThumbnail(clip),
              clipSource: 'TWITCH',
              externalId: clip.id,
              duration: Math.round(clip.duration),
              viewCount: clip.view_count,
              authorId: BOT_USER_ID,
              streamerProfileId: streamer.id,
              isOfficial: true,
            },
          });
          existingIds.add(clip.id);
          imported++;
          totalImported++;
        } catch (err: any) {
          // Unique constraint or other DB error — skip
          if (err.code === 'P2002') {
            skipped++;
          } else {
            console.error(`  ❌ DB error for clip ${clip.id}: ${err.message}`);
            totalErrors++;
          }
        }
      }

      if (imported > 0) {
        streamersWithClips++;
        console.log(`${prefix}: +${imported} clips (${skipped} skipped) [${clips.length} found]`);
      }

      totalSkipped += skipped;

      // Small delay between streamers to respect rate limits (~800 req/min)
      // Every 30 streamers, add a longer pause
      if (streamersProcessed % 30 === 0) {
        await sleep(2000);
      } else {
        await sleep(100);
      }
    } catch (err: any) {
      console.error(`${prefix}: ERROR ${err.message}`);
      totalErrors++;
    }

    // Progress every 100
    if (streamersProcessed % 100 === 0) {
      console.log(`\n📊 Progress: ${streamersProcessed}/${streamers.length} streamers | ${totalImported} clips imported\n`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`✅ Import complete!`);
  console.log(`   Streamers processed: ${streamersProcessed}`);
  console.log(`   Streamers with clips: ${streamersWithClips}`);
  console.log(`   Clips imported: ${totalImported}`);
  console.log(`   Clips skipped (dupes): ${totalSkipped}`);
  console.log(`   Errors: ${totalErrors}`);
  console.log('═══════════════════════════════════════');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
