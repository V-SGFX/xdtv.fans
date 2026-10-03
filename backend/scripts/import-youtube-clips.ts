/**
 * Import YouTube Shorts + popular videos for Polish gaming YouTubers in DB.
 *
 * Usage:  npx tsx scripts/import-youtube-clips.ts [streamerCount] [videosPerStreamer]
 *   defaults: 500 streamers, 5 videos each
 *
 * Requires YOUTUBE_API_KEY in .env
 *
 * Creates Post records with type=CLIP, clipSource=YOUTUBE.
 * Shorts are detected by duration (≤60s) or #shorts in title.
 */

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const API_KEY = process.env.YOUTUBE_API_KEY!;
const BOT_USER_ID = 4; // xdtv_mapet user
const STREAMER_COUNT = parseInt(process.argv[2] || '500', 10);
const VIDEOS_PER_STREAMER = parseInt(process.argv[3] || '5', 10);

if (!API_KEY) {
  console.error('❌ YOUTUBE_API_KEY is not set in .env');
  process.exit(1);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════
//  YOUTUBE API HELPERS
// ═══════════════════════════════════════════════════════════

interface YTVideo {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
    publishedAt: string;
  };
  contentDetails?: {
    duration: string; // ISO 8601 e.g. "PT1M30S"
  };
  statistics?: {
    viewCount: string;
    likeCount: string;
  };
}

function parseDuration(iso: string): number {
  // PT1H2M3S → seconds
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || '0') * 3600) + (parseInt(match[2] || '0') * 60) + parseInt(match[3] || '0');
}

async function ytSearchVideos(channelId: string, type: 'short' | 'popular', maxResults: number): Promise<string[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('part', 'id');
  url.searchParams.set('channelId', channelId);
  url.searchParams.set('type', 'video');
  url.searchParams.set('order', 'viewCount');
  url.searchParams.set('maxResults', String(maxResults));

  if (type === 'short') {
    url.searchParams.set('videoDuration', 'short'); // ≤4 min
  }

  const res = await fetch(url.toString());
  if (res.status === 403) {
    const data = await res.json();
    if (data?.error?.errors?.[0]?.reason === 'quotaExceeded') {
      console.error('❌ YouTube quota exceeded!');
      return [];
    }
  }
  if (!res.ok) return [];

  const data = await res.json();
  return (data.items || [])
    .filter((i: any) => i.id?.videoId)
    .map((i: any) => i.id.videoId);
}

async function ytGetVideoDetails(ids: string[]): Promise<YTVideo[]> {
  if (ids.length === 0) return [];

  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('part', 'snippet,contentDetails,statistics');
  url.searchParams.set('id', ids.join(','));

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json();
  return data.items || [];
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('🎬 YouTube Clips & Shorts Import');
  console.log(`   Streamers: ${STREAMER_COUNT} | Videos/streamer: ${VIDEOS_PER_STREAMER}\n`);

  // Get top YouTubers by follower count
  const streamers = await prisma.streamerProfile.findMany({
    where: { youtubeId: { not: null } },
    orderBy: { followerCount: 'desc' },
    take: STREAMER_COUNT,
    select: { id: true, name: true, youtubeId: true, followerCount: true },
  });

  console.log(`📋 Found ${streamers.length} streamers with youtubeId`);

  // Get existing YouTube clips to avoid dupes
  const existingClips = await prisma.post.findMany({
    where: { type: 'CLIP', clipSource: 'YOUTUBE', externalId: { not: null } },
    select: { externalId: true },
  });
  const existingIds = new Set(existingClips.map(c => c.externalId));
  console.log(`📦 ${existingIds.size} existing YouTube clips in DB\n`);

  let totalImported = 0;
  let totalShorts = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let processed = 0;
  let quotaUsed = 0;

  for (const streamer of streamers) {
    processed++;
    const prefix = `[${processed}/${streamers.length}] ${streamer.name}`;

    try {
      // Search for popular shorts (≤4min, will filter ≤60s later)
      const shortVideoIds = await ytSearchVideos(streamer.youtubeId!, 'short', VIDEOS_PER_STREAMER);
      quotaUsed += 100;

      // Search for popular clips/videos
      const popularVideoIds = await ytSearchVideos(streamer.youtubeId!, 'popular', VIDEOS_PER_STREAMER);
      quotaUsed += 100;

      // Combine unique IDs
      const allIds = [...new Set([...shortVideoIds, ...popularVideoIds])].filter(id => !existingIds.has(id));

      if (allIds.length === 0) continue;

      // Get video details
      const videos = await ytGetVideoDetails(allIds);
      quotaUsed += Math.ceil(allIds.length / 50);

      let imported = 0;
      let shorts = 0;

      for (const video of videos) {
        if (existingIds.has(video.id)) continue;

        const duration = parseDuration(video.contentDetails?.duration || 'PT0S');
        const viewCount = parseInt(video.statistics?.viewCount || '0', 10);
        const isShort = duration <= 60 ||
          video.snippet.title.toLowerCase().includes('#shorts') ||
          video.snippet.title.toLowerCase().includes('#short');

        const thumbnailUrl = video.snippet.thumbnails?.high?.url
          || video.snippet.thumbnails?.medium?.url
          || video.snippet.thumbnails?.default?.url;

        try {
          await prisma.post.create({
            data: {
              title: video.snippet.title.slice(0, 200),
              content: '',
              type: 'CLIP',
              videoUrl: isShort
                ? `https://www.youtube.com/shorts/${video.id}`
                : `https://www.youtube.com/watch?v=${video.id}`,
              thumbnailUrl: thumbnailUrl || null,
              clipSource: 'YOUTUBE',
              externalId: video.id,
              duration: duration || null,
              viewCount,
              authorId: BOT_USER_ID,
              streamerProfileId: streamer.id,
              isOfficial: true,
            },
          });
          existingIds.add(video.id);
          imported++;
          totalImported++;
          if (isShort) { shorts++; totalShorts++; }
        } catch (err: any) {
          if (err.code === 'P2002') {
            totalSkipped++;
          } else {
            totalErrors++;
          }
        }
      }

      if (imported > 0) {
        console.log(`${prefix}: +${imported} (${shorts} shorts) [${videos.length} found]`);
      }

      // Pace limiting
      if (processed % 20 === 0) {
        await sleep(2000);
      } else {
        await sleep(200);
      }

      // Check quota (search = 100 units each, target is 10k/day)
      if (quotaUsed > 9500) {
        console.warn('\n⚠️ Approaching YouTube API daily quota limit. Stopping.');
        break;
      }
    } catch (err: any) {
      console.error(`${prefix}: ERROR ${err.message}`);
      totalErrors++;
    }

    if (processed % 50 === 0) {
      console.log(`\n📊 Progress: ${processed}/${streamers.length} | Imported: ${totalImported} (${totalShorts} shorts) | Quota: ~${quotaUsed}\n`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ YouTube Clips & Shorts Import Complete!`);
  console.log(`   Processed: ${processed} streamers`);
  console.log(`   Imported: ${totalImported} videos`);
  console.log(`   - Shorts: ${totalShorts}`);
  console.log(`   - Regular clips: ${totalImported - totalShorts}`);
  console.log(`   Skipped (dupes): ${totalSkipped}`);
  console.log(`   Errors: ${totalErrors}`);
  console.log(`   API quota used: ~${quotaUsed} units`);
  console.log('═══════════════════════════════════════');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
