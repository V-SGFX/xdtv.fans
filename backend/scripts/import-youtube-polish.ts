/**
 * Import Polish gaming/streaming YouTubers into xdtv DB.
 *
 * Usage:  npx tsx scripts/import-youtube-polish.ts [batchSize] [totalTarget]
 *   defaults: 500 per batch, 5000 total
 *
 * Requires YOUTUBE_API_KEY in .env (YouTube Data API v3)
 * Quota: search = 100 units/req, channels.list = 1 unit/req
 * Daily limit: 10,000 units → ~100 searches → ~5000 results
 */

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const API_KEY = process.env.YOUTUBE_API_KEY!;
const BATCH_SIZE = parseInt(process.argv[2] || '500', 10);
const TOTAL_TARGET = parseInt(process.argv[3] || '5000', 10);

if (!API_KEY) {
  console.error('❌ YOUTUBE_API_KEY is not set in .env');
  console.error('   Go to https://console.cloud.google.com/apis/credentials');
  console.error('   Create Credentials → API Key');
  process.exit(1);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════
//  SEARCH QUERIES — Polish gaming YouTubers
// ═══════════════════════════════════════════════════════════

const SEARCH_QUERIES = [
  // Polish gaming general
  'polski gaming', 'polskie gry', 'polski streamer youtube', 'polskie filmy gry',
  'gry po polsku', 'gramy po polsku', 'let\'s play po polsku', 'gameplay po polsku',
  'polski youtuber gaming', 'polski gracz', 'polskie gameplaye',
  'polskie recenzje gier', 'polskie poradniki gry',

  // Specific games (Polish scene)
  'tibia polska', 'tibia pl', 'tibia gameplay polski', 'tibia poradnik',
  'tibia boss', 'tibia quest', 'tibia hunt', 'tibia update', 'tibia knight',
  'tibia paladin', 'tibia druid', 'tibia sorcerer', 'tibia war',
  'CS2 po polsku', 'CS2 polska', 'counter strike polska', 'csgo polski',
  'valorant polska', 'valorant po polsku', 'valorant pl',
  'league of legends polska', 'lol po polsku', 'lol polska',
  'minecraft po polsku', 'minecraft polska', 'minecraft pl',
  'fortnite po polsku', 'fortnite polska',
  'GTA V polska', 'GTA RP polska', 'GTA online po polsku',
  'Roblox po polsku', 'Roblox polska',
  'FIFA polska', 'FC24 po polsku', 'FC25 polska',
  'Dead by Daylight polska', 'dbd po polsku',
  'Among Us po polsku', 'among us polska',
  'Apex Legends polska', 'apex po polsku',
  'Overwatch polska', 'overwatch po polsku',
  'Dota 2 polska', 'dota po polsku',
  'World of Warcraft polska', 'wow po polsku',
  'Path of Exile polska', 'poe po polsku',
  'Diablo polska', 'diablo po polsku',
  'Elden Ring po polsku', 'elden ring polska',
  'Baldur\'s Gate 3 po polsku', 'baldurs gate polska',
  'Hogwarts Legacy po polsku',
  'Cyberpunk 2077 po polsku', 'cyberpunk polska',
  'gothic polska', 'gothic po polsku', 'gothic 1 2 3',

  // Streaming/content types
  'polski stream', 'polskie streamy', 'polskie kompilacje gaming',
  'top polski gaming', 'najlepsze polskie gameplaye',
  'funny moments po polsku', 'śmieszne momenty gaming polska',
  'polski esport', 'esport polska', 'polskie turnieje',
  'polskie highlighty', 'polskie klipy gaming',

  // Known Polish gaming YouTuber search patterns
  'stuu gry', 'rezi gry', 'vertez gry', 'isamu gry',
  'gimper gry', 'multi gry', 'blowek gry', 'friz gry',
  'eleven gry', 'step gry', 'roll gry', 'rock gry',
  'ambro gry', 'nexe gry', 'mokebe gry', 'junajted gry',

  // Categories & niches
  'horror gry polska', 'indie gry polska', 'retro gry polska',
  'symulator po polsku', 'survival po polsku', 'mmo polska',
  'rpg po polsku', 'fps polska', 'battle royale polska',
  'strategia po polsku', 'polski lets play',

  // Polish Tibia YouTube (big scene)
  'tibia pl youtube', 'tibia polska youtube', 'tibia hunting guide',
  'tibia gdzie expić', 'tibia zarabianie', 'tibia pvp polska',
  'tibia facc', 'tibia pacc', 'tibia rookgaard', 'tibia cipsoft',
  'tibia bosshunter', 'tibia ferobra', 'tibia antica', 'tibia secura',
  'tibia premia', 'tibia vunira', 'tibia monza', 'tibia peloria',
];

// ═══════════════════════════════════════════════════════════
//  YOUTUBE API HELPERS
// ═══════════════════════════════════════════════════════════

interface YTSearchResult {
  kind: string;
  id: { kind: string; channelId?: string; videoId?: string };
  snippet: {
    channelId: string;
    channelTitle: string;
    title: string;
    description: string;
    thumbnails: { default?: { url: string }; high?: { url: string } };
  };
}

interface YTChannel {
  id: string;
  snippet: {
    title: string;
    description: string;
    customUrl?: string;
    thumbnails: { default?: { url: string }; high?: { url: string }; medium?: { url: string } };
    country?: string;
  };
  statistics: {
    subscriberCount: string;
    viewCount: string;
    videoCount: string;
  };
  brandingSettings?: {
    image?: { bannerExternalUrl?: string };
  };
}

async function ytSearch(query: string, pageToken?: string): Promise<{ items: YTSearchResult[]; nextPageToken?: string }> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'channel');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', '50');
  url.searchParams.set('relevanceLanguage', 'pl');
  url.searchParams.set('regionCode', 'PL');
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  const res = await fetch(url.toString());
  if (res.status === 403) {
    const data = await res.json();
    const reason = data?.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded') {
      console.error('❌ YouTube API daily quota exceeded! Try again tomorrow.');
      return { items: [] };
    }
    console.warn(`⚠️ YouTube 403: ${reason || JSON.stringify(data)}`);
    return { items: [] };
  }
  if (!res.ok) {
    console.warn(`⚠️ YouTube search error ${res.status}: ${await res.text()}`);
    return { items: [] };
  }
  return res.json();
}

async function ytGetChannels(channelIds: string[]): Promise<YTChannel[]> {
  const all: YTChannel[] = [];
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('part', 'snippet,statistics,brandingSettings');
    url.searchParams.set('id', batch.join(','));

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn(`⚠️ channels.list error ${res.status}`);
      continue;
    }
    const data = await res.json();
    if (data.items) all.push(...data.items);
    await sleep(100);
  }
  return all;
}

// ═══════════════════════════════════════════════════════════
//  IMPORT LOGIC
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('🎬 YouTube Polish Gaming Streamer Import');
  console.log(`   Target: ~${TOTAL_TARGET} | Batch: ${BATCH_SIZE}`);
  console.log(`   Queries: ${SEARCH_QUERIES.length}`);
  console.log('');

  const seen = new Set<string>();
  const channelIds: string[] = [];

  // Load existing youtubeIds to avoid re-processing
  const existing = await prisma.streamerProfile.findMany({
    where: { youtubeId: { not: null } },
    select: { youtubeId: true },
  });
  existing.forEach(e => seen.add(e.youtubeId!));
  console.log(`📦 ${seen.size} existing YouTube profiles in DB\n`);

  // Phase 1: Search for channels
  let quotaUsed = 0;
  for (const query of SEARCH_QUERIES) {
    if (channelIds.length >= TOTAL_TARGET) break;

    let pageToken: string | undefined;
    let pages = 0;
    const maxPages = 3; // 3 pages × 50 results = 150 per query

    while (pages < maxPages && channelIds.length < TOTAL_TARGET) {
      const result = await ytSearch(query, pageToken);
      quotaUsed += 100; // search costs 100 units

      if (!result.items?.length) break;

      for (const item of result.items) {
        const cid = item.snippet.channelId || item.id.channelId;
        if (cid && !seen.has(cid)) {
          seen.add(cid);
          channelIds.push(cid);
        }
      }

      pageToken = result.nextPageToken;
      if (!pageToken) break;
      pages++;
      await sleep(200);
    }

    if (channelIds.length % 100 < 50) {
      console.log(`🔍 "${query}" → ${channelIds.length} unique channels (quota: ~${quotaUsed} units)`);
    }

    await sleep(150);
  }

  console.log(`\n📋 Found ${channelIds.length} unique channel IDs (quota used: ~${quotaUsed} units)\n`);

  if (channelIds.length === 0) {
    console.log('No channels found. Check API key and quota.');
    await prisma.$disconnect();
    return;
  }

  // Phase 2: Get channel details in batches
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < channelIds.length; i += BATCH_SIZE) {
    const batchIds = channelIds.slice(i, i + BATCH_SIZE);
    console.log(`\n💾 Batch ${Math.floor(i / BATCH_SIZE) + 1}: fetching details for ${batchIds.length} channels...`);

    const channels = await ytGetChannels(batchIds);
    quotaUsed += Math.ceil(batchIds.length / 50); // channels.list = 1 unit per request

    for (const ch of channels) {
      const slug = (ch.snippet.customUrl || ch.snippet.title)
        .toLowerCase()
        .replace(/^@/, '')
        .replace(/[^a-z0-9ąćęłńóśźż-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || `yt-${ch.id.slice(0, 12)}`;

      const avatarUrl = ch.snippet.thumbnails?.high?.url
        || ch.snippet.thumbnails?.medium?.url
        || ch.snippet.thumbnails?.default?.url
        || null;

      const bannerUrl = ch.brandingSettings?.image?.bannerExternalUrl || null;
      const subscriberCount = parseInt(ch.statistics.subscriberCount || '0', 10);
      const viewCount = parseInt(ch.statistics.viewCount || '0', 10);

      try {
        // Check if this YouTube channel already exists
        let existingProfile = await prisma.streamerProfile.findUnique({
          where: { youtubeId: ch.id },
        });

        if (existingProfile) {
          // Update with YouTube data
          const updateData: any = {};
          if (!existingProfile.youtubeUrl) updateData.youtubeUrl = `https://youtube.com/${ch.snippet.customUrl || 'channel/' + ch.id}`;
          if (!existingProfile.avatarUrl && avatarUrl) updateData.avatarUrl = avatarUrl;
          if (!existingProfile.bannerUrl && bannerUrl) updateData.bannerUrl = bannerUrl;
          if (!existingProfile.bio && ch.snippet.description) updateData.bio = ch.snippet.description.slice(0, 500);
          if (subscriberCount > existingProfile.followerCount) updateData.followerCount = subscriberCount;

          if (Object.keys(updateData).length > 0) {
            await prisma.streamerProfile.update({ where: { id: existingProfile.id }, data: updateData });
            updated++;
          } else {
            skipped++;
          }
          continue;
        }

        // Try to find by slug
        existingProfile = await prisma.streamerProfile.findUnique({ where: { slug } });
        if (existingProfile) {
          // Slug exists — update with YouTube data
          const updateData: any = {};
          if (!existingProfile.youtubeId) updateData.youtubeId = ch.id;
          if (!existingProfile.youtubeUrl) updateData.youtubeUrl = `https://youtube.com/${ch.snippet.customUrl || 'channel/' + ch.id}`;
          if (!existingProfile.avatarUrl && avatarUrl) updateData.avatarUrl = avatarUrl;
          if (!existingProfile.bannerUrl && bannerUrl) updateData.bannerUrl = bannerUrl;

          if (Object.keys(updateData).length > 0) {
            await prisma.streamerProfile.update({ where: { id: existingProfile.id }, data: updateData });
            updated++;
          } else {
            skipped++;
          }
          continue;
        }

        // Create new YouTube-only profile
        await prisma.streamerProfile.create({
          data: {
            slug,
            name: ch.snippet.title,
            bio: ch.snippet.description?.slice(0, 500) || null,
            avatarUrl,
            bannerUrl,
            youtubeUrl: `https://youtube.com/${ch.snippet.customUrl || 'channel/' + ch.id}`,
            youtubeId: ch.id,
            followerCount: subscriberCount,
            viewCount,
          },
        });
        created++;
      } catch (err: any) {
        if (err.code === 'P2002') {
          // Unique constraint — slug collision, append suffix
          try {
            await prisma.streamerProfile.create({
              data: {
                slug: `${slug}-yt`,
                name: ch.snippet.title,
                bio: ch.snippet.description?.slice(0, 500) || null,
                avatarUrl,
                bannerUrl,
                youtubeUrl: `https://youtube.com/${ch.snippet.customUrl || 'channel/' + ch.id}`,
                youtubeId: ch.id,
                followerCount: subscriberCount,
                viewCount,
              },
            });
            created++;
          } catch {
            skipped++;
          }
        } else {
          console.error(`  ⚠ Error for ${ch.snippet.title}: ${err.message}`);
          skipped++;
        }
      }
    }

    console.log(`   ✅ Batch done: +${created} created, ${updated} updated, ${skipped} skipped (total so far)`);
    await sleep(500);
  }

  const total = await prisma.streamerProfile.count();
  const ytOnly = await prisma.streamerProfile.count({ where: { youtubeId: { not: null }, twitchId: null, kickId: null } });

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ YouTube Import Complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   API quota used: ~${quotaUsed} units`);
  console.log(`   Total in DB: ${total} (${ytOnly} YouTube-only)`);
  console.log('═══════════════════════════════════════');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
