/**
 * Import international streamers from Twitch Helix API.
 * 
 * Fetches top streamers across multiple languages, creates profiles in DB.
 * Also tries to find associated YouTube channels.
 * 
 * Usage: npx tsx scripts/import-international-streamers.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

const TARGET_TOTAL = 30000;
const BATCH_SIZE = 100;

// Languages to fetch streamers from (excluding Polish which is already imported)
const LANGUAGES = [
  'en', 'es', 'pt', 'de', 'fr', 'ko', 'ja', 'ru', 'it', 'tr',
  'zh', 'th', 'ar', 'sv', 'nl', 'cs', 'hu', 'no', 'da', 'fi',
  'uk', 'ro', 'el', 'bg', 'vi', 'id', 'ms', 'hi', 'tl',
  'sk', 'hr', 'lt', 'lv', 'et', 'sl', 'ca', 'eu', 'gl', 'hy',
  'ka', 'az', 'kk', 'uz', 'mn', 'ne', 'si', 'my', 'km', 'lo',
];

// Top game categories for searching
const TOP_GAMES = [
  '509658', // Just Chatting
  '32982',  // Grand Theft Auto V
  '21779',  // League of Legends
  '516575', // VALORANT
  '33214',  // Fortnite
  '32399',  // Counter-Strike 2
  '263490', // Rust
  '27471',  // Minecraft
  '511224', // Apex Legends
  '29595',  // Dota 2
  '512710', // Call of Duty: Warzone
  '520474', // FIFA/EA FC
  '491487', // Dead by Daylight
  '518203', // Overwatch 2
  '515025', // Teamfight Tactics
  '513143', // World of Warcraft  
  '460630', // Escape from Tarkov
  '26936',  // Music
  '509660', // Art
  '116747639', // Slots
  '512953', // Elden Ring
  '138585', // Hearthstone
  '18122',  // World of Tanks
  '65632',  // DayZ
  '29452',  // Virtual Casino
  '498566', // Genshin Impact
  '61469',  // Tom Clancy
  '493057', // PUBG
  '460633', // Halo
  '511399', // Phasmophobia
  '32507',  // Smite
  '488191', // Path of Exile
  '509659', // ASMR
  '26168',  // Terraria
  '7940',   // Heroes of Might & Magic
  '492764', // Hunt: Showdown
  '65876',  // Paladins
  '514974', // Sea of Thieves
  '515467', // Stumble Guys
  '29307',  // Path of Exile
  '495064', // Naraka
  '27546',  // World of Warships
  '69773',  // Satisfactory
  '30921',  // Rocket League
  '488552', // Mortal Kombat
  '490100', // Lost Ark
  '386821', // Black Desert Online
  '6672',   // Arma
  '511748', // Baldur's Gate 3
  '518032', // Stardew Valley
  '490655', // Albion Online
  '272263', // Farming Simulator
  '498000', // Final Fantasy XIV
  '496712', // Yu-Gi-Oh!
  '29407',  // Destiny 2
  '497057', // Project Zomboid
  '509667', // Food & Drink
  '509670', // Science & Technology
  '509673', // Animals & Pets
  '417752', // Talk Shows & Podcasts
  '515467', // Geoguessr
];

interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  is_mature: boolean;
}

interface TwitchChannel {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  broadcaster_language: string;
  game_id: string;
  game_name: string;
  title: string;
  description: string;
  thumbnail_url: string;
  is_live: boolean;
}

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  view_count: number;
  created_at: string;
}

let twitchToken = '';
let tokenExpiresAt = 0;

async function getTwitchToken(): Promise<string> {
  if (twitchToken && Date.now() < tokenExpiresAt) return twitchToken;

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
  twitchToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return twitchToken;
}

async function twitchGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<{ data: T[]; pagination?: { cursor?: string } }> {
  const token = await getTwitchToken();
  const url = new URL(`https://api.twitch.tv/helix/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`,
    },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Ratelimit-Reset') || '5') * 1000 - Date.now();
    console.log(`Rate limited, waiting ${Math.max(retryAfter, 2000)}ms...`);
    await sleep(Math.max(retryAfter, 2000));
    return twitchGet(endpoint, params);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitch API error ${res.status}: ${text}`);
  }

  return res.json();
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

// ─── FETCH STREAMS BY LANGUAGE ─────────────────────────

async function fetchStreamsByLanguage(language: string, maxPages: number = 5): Promise<Map<string, TwitchStream>> {
  const streams = new Map<string, TwitchStream>();
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      first: '100',
      language,
    };
    if (cursor) params.after = cursor;

    const res = await twitchGet<TwitchStream>('streams', params);
    for (const stream of res.data) {
      streams.set(stream.user_id, stream);
    }

    cursor = res.pagination?.cursor;
    if (!cursor || res.data.length < 100) break;
    await sleep(100);
  }

  return streams;
}

// ─── FETCH STREAMS BY GAME ─────────────────────────

async function fetchStreamsByGame(gameId: string, maxPages: number = 3): Promise<Map<string, TwitchStream>> {
  const streams = new Map<string, TwitchStream>();
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      first: '100',
      game_id: gameId,
    };
    if (cursor) params.after = cursor;

    const res = await twitchGet<TwitchStream>('streams', params);
    for (const stream of res.data) {
      streams.set(stream.user_id, stream);
    }

    cursor = res.pagination?.cursor;
    if (!cursor || res.data.length < 100) break;
    await sleep(100);
  }

  return streams;
}

// ─── SEARCH CHANNELS ─────────────────────────

async function searchChannels(query: string, maxPages: number = 5): Promise<Map<string, TwitchChannel>> {
  const channels = new Map<string, TwitchChannel>();
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      query,
      first: '100',
      live_only: 'false',
    };
    if (cursor) params.after = cursor;

    const res = await twitchGet<TwitchChannel>('search/channels', params);
    for (const ch of res.data) {
      channels.set(ch.broadcaster_id, ch);
    }

    cursor = res.pagination?.cursor;
    if (!cursor || res.data.length < 100) break;
    await sleep(100);
  }

  return channels;
}

// ─── GET USER DETAILS IN BATCH ─────────────────────────

async function getUserDetails(userIds: string[]): Promise<Map<string, TwitchUser>> {
  const users = new Map<string, TwitchUser>();

  for (let i = 0; i < userIds.length; i += 100) {
    const batch = userIds.slice(i, i + 100);
    const params: Record<string, string> = {};
    // Twitch API expects multiple id= params, but our helper only does key=value
    // We need to build the URL manually
    const token = await getTwitchToken();
    const url = new URL('https://api.twitch.tv/helix/users');
    for (const id of batch) url.searchParams.append('id', id);

    const res = await fetch(url.toString(), {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (res.status === 429) {
      await sleep(3000);
      i -= 100; // retry this batch
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      for (const user of data.data) {
        users.set(user.id, user);
      }
    }
    await sleep(100);
  }

  return users;
}

// ─── GET FOLLOWER COUNT IN BATCH ─────────────────────────

async function getFollowerCounts(userIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  for (const userId of userIds) {
    try {
      const res = await twitchGet<{ total: number }>('channels/followers', {
        broadcaster_id: userId,
        first: '1',
      });
      // The total is in the response directly
      const rawRes = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${userId}&first=1`, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${await getTwitchToken()}`,
        },
      });
      if (rawRes.ok) {
        const data = await rawRes.json();
        counts.set(userId, data.total || 0);
      }
    } catch {
      counts.set(userId, 0);
    }
    await sleep(50); // Rate limit friendly
  }

  return counts;
}

// ─── SEARCH YOUTUBE CHANNELS ─────────────────────────

async function searchYouTubeChannel(query: string): Promise<string | null> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'channel');
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', '1');
    url.searchParams.set('key', YOUTUBE_API_KEY);

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json();
    if (data.items?.[0]?.snippet) {
      return data.items[0].snippet.channelId || data.items[0].id?.channelId;
    }
  } catch { /* ignore */ }
  return null;
}

// ─── UPSERT STREAMERS ─────────────────────────

async function upsertStreamers(
  streamData: Array<{
    twitchId: string;
    login: string;
    displayName: string;
    description: string;
    avatarUrl: string;
    viewCount: number;
    followerCount: number;
    isLive: boolean;
    youtubeId?: string | null;
  }>
) {
  let created = 0;
  let skipped = 0;

  for (const s of streamData) {
    const slug = slugify(s.login);
    if (!slug) { skipped++; continue; }

    try {
      // Check if already exists by twitchId or slug
      const existing = await prisma.streamerProfile.findFirst({
        where: {
          OR: [
            { twitchId: s.twitchId },
            { slug },
          ],
        },
      });

      if (existing) {
        // Update follower count if higher
        if (s.followerCount > existing.followerCount) {
          await prisma.streamerProfile.update({
            where: { id: existing.id },
            data: { followerCount: s.followerCount },
          });
        }
        skipped++;
        continue;
      }

      await prisma.streamerProfile.create({
        data: {
          slug,
          name: s.displayName,
          bio: s.description?.substring(0, 500) || null,
          avatarUrl: s.avatarUrl || null,
          twitchId: s.twitchId,
          twitchUrl: `https://twitch.tv/${s.login}`,
          youtubeId: s.youtubeId || null,
          youtubeUrl: s.youtubeId ? `https://youtube.com/channel/${s.youtubeId}` : null,
          isClaimed: false,
          isVerified: false,
          isLive: s.isLive,
          viewCount: s.viewCount,
          followerCount: s.followerCount,
        },
      });
      created++;
    } catch (err: any) {
      if (err.code === 'P2002') {
        skipped++; // Unique constraint violation
      } else {
        console.error(`Error creating ${s.login}:`, err.message);
        skipped++;
      }
    }
  }

  return { created, skipped };
}

// ─── MAIN ─────────────────────────

async function main() {
  console.log('🌍 International Streamer Import');
  console.log('================================\n');

  const currentCount = await prisma.streamerProfile.count();
  console.log(`Current streamer count: ${currentCount}`);
  const needed = TARGET_TOTAL - currentCount;

  if (needed <= 0) {
    console.log(`✅ Already at ${currentCount} profiles (target: ${TARGET_TOTAL}). Done.`);
    return;
  }

  console.log(`Need to import ~${needed} more streamers to reach ${TARGET_TOTAL}\n`);

  // Collect all unique Twitch user IDs
  const allStreams = new Map<string, TwitchStream>();
  const allChannels = new Map<string, TwitchChannel>();

  // Phase 1: Fetch live streams by language
  console.log('📺 Phase 1: Fetching live streams by language...');
  for (const lang of LANGUAGES) {
    const streams = await fetchStreamsByLanguage(lang, 30);
    for (const [id, stream] of streams) {
      if (stream.language !== 'pl') allStreams.set(id, stream);
    }
    process.stdout.write(`  ${lang}: +${streams.size} (total unique: ${allStreams.size})\n`);
    await sleep(150);
  }

  console.log(`\n  Total unique streamers from live: ${allStreams.size}\n`);

  // Phase 2: Fetch by game category
  {
    console.log('🎮 Phase 2: Fetching streams by top games...');
    for (const gameId of TOP_GAMES) {
      const streams = await fetchStreamsByGame(gameId, 15);
      for (const [id, stream] of streams) {
        if (stream.language !== 'pl') allStreams.set(id, stream);
      }
      process.stdout.write(`  Game ${gameId}: +${streams.size} (total unique: ${allStreams.size})\n`);
      await sleep(200);
    }
    console.log(`\n  Total unique streamers: ${allStreams.size}\n`);
  }

  // Phase 3: Search popular streaming terms
  {
    console.log('🔍 Phase 3: Searching channels by keywords...');
    const searchTerms = [
      'gaming', 'stream', 'live', 'esports', 'gamer', 'twitch',
      'fps', 'moba', 'mmo', 'speedrun', 'irl', 'vtuber',
      'valorant', 'league', 'fortnite', 'minecraft', 'gta',
      'apex', 'warzone', 'overwatch', 'dota', 'csgo',
      'streamer', 'pro player', 'variety', 'games', 'gameplay',
      'cod', 'pokemon', 'mario', 'zelda', 'roblox', 'anime',
      'horror', 'survival', 'rpg', 'battle royale', 'creative',
      'music', 'art', 'cooking', 'travel', 'fitness',
      'chess', 'poker', 'racing', 'sports', 'basketball',
      'soccer', 'football', 'tennis', 'boxing', 'mma',
      'simulator', 'strategy', 'puzzle', 'indie', 'retro',
      'cosplay', 'asmr', 'djing', 'beatbox', 'piano',
      'guitar', 'karaoke', 'dance', 'painting', 'drawing',
      'cooking stream', 'gym', 'outdoor', 'camping', 'fishing',
      'car', 'tech', 'programming', 'science', 'education',
      'news', 'reaction', 'podcast', 'talk show', 'debate',
      'challenge', 'unboxing', 'review', 'tutorial', 'guide',
      'compilation', 'highlights', 'montage', 'clutch', 'funny',
      'rage', 'fail', 'win', 'clutch moments', 'best plays',
    ];

    for (const term of searchTerms) {
      const channels = await searchChannels(term, 10);
      for (const [id, ch] of channels) {
        if (ch.broadcaster_language !== 'pl') allChannels.set(id, ch);
      }
      process.stdout.write(`  "${term}": +${channels.size} (total unique channels: ${allChannels.size})\n`);
      await sleep(150);
    }
    console.log(`\n  Total unique channels from search: ${allChannels.size}\n`);
  }

  // Merge all user IDs
  const allUserIds = new Set<string>();
  for (const id of allStreams.keys()) allUserIds.add(id);
  for (const id of allChannels.keys()) allUserIds.add(id);

  // Filter out already-imported Twitch IDs
  const existingTwitchIds = await prisma.streamerProfile.findMany({
    where: { twitchId: { not: null } },
    select: { twitchId: true },
  });
  const existingSet = new Set(existingTwitchIds.map(e => e.twitchId!));

  const newUserIds = [...allUserIds].filter(id => !existingSet.has(id));
  console.log(`🆕 New streamers to import: ${newUserIds.length} (existing: ${existingSet.size})\n`);

  if (newUserIds.length === 0) {
    console.log('No new streamers found. Try running again later when different streamers are live.');
    return;
  }

  // Phase 4: Get user details
  console.log('👤 Phase 4: Fetching user details...');
  const limitedIds = newUserIds.slice(0, Math.min(needed + 1000, newUserIds.length));
  const userDetails = await getUserDetails(limitedIds);
  console.log(`  Got details for ${userDetails.size} users\n`);

  // Phase 5: Create profiles in batches
  console.log('💾 Phase 5: Creating profiles in database...');
  let totalCreated = 0;
  let totalSkipped = 0;

  const usersArray = [...userDetails.values()];
  for (let i = 0; i < usersArray.length; i += BATCH_SIZE) {
    const batch = usersArray.slice(i, i + BATCH_SIZE);

    const streamData = batch.map(user => {
      const stream = allStreams.get(user.id);
      return {
        twitchId: user.id,
        login: user.login,
        displayName: user.display_name,
        description: user.description || '',
        avatarUrl: user.profile_image_url || '',
        viewCount: user.view_count || 0,
        followerCount: 0, // Will be updated by platform-sync cron
        isLive: stream?.type === 'live',
        youtubeId: null as string | null,
      };
    });

    const { created, skipped } = await upsertStreamers(streamData);
    totalCreated += created;
    totalSkipped += skipped;

    const currentDbCount = await prisma.streamerProfile.count();
    process.stdout.write(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: created ${created}, skipped ${skipped} (DB total: ${currentDbCount})\n`);

    if (currentDbCount >= TARGET_TOTAL) {
      console.log(`\n🎯 Reached target of ${TARGET_TOTAL}!`);
      break;
    }

    await sleep(100);
  }

  const finalCount = await prisma.streamerProfile.count();
  console.log(`\n================================`);
  console.log(`✅ Import complete!`);
  console.log(`   Created: ${totalCreated}`);
  console.log(`   Skipped: ${totalSkipped}`);
  console.log(`   Total profiles in DB: ${finalCount}`);
  console.log(`   Target: ${TARGET_TOTAL}`);

  if (finalCount < TARGET_TOTAL) {
    console.log(`\n⚠️  Still ${TARGET_TOTAL - finalCount} short. Run again later when different streamers are live.`);
    console.log(`   The platform-sync cron will update follower counts automatically.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
