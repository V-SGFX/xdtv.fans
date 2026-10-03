import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID!;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!;
const KICK_CLIENT_ID = process.env.KICK_CLIENT_ID!;
const KICK_CLIENT_SECRET = process.env.KICK_CLIENT_SECRET!;

const MAX_TOTAL = 30_000;
const UPSERT_BATCH = 1000;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface RawStreamer {
  slug: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  twitchUrl?: string;
  kickUrl?: string;
  twitchId?: string;
  kickId?: string;
  followerCount: number;
  viewCount: number;
}

// ═══════════════════════════════════════════════════════════
//  TWITCH
// ═══════════════════════════════════════════════════════════

async function getTwitchToken(): Promise<string> {
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
  if (!data.access_token) throw new Error(`Twitch token fail: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function twitchGet(token: string, url: string) {
  const res = await fetch(url, {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`,
    },
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get('Ratelimit-Reset') || 2);
    console.log(`  ⏳ Twitch rate limit, waiting ${retry}s...`);
    await sleep(retry * 1000);
    return twitchGet(token, url);
  }
  return res.json();
}

async function fetchTwitchUsers(token: string, ids: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const url = new URL('https://api.twitch.tv/helix/users');
    batch.forEach(id => url.searchParams.append('id', id));
    const data = await twitchGet(token, url.toString());
    for (const u of (data.data || [])) map.set(u.id, u);
    await sleep(60);
  }
  return map;
}

async function fetchTwitchStreamers(maxResults: number): Promise<RawStreamer[]> {
  const token = await getTwitchToken();
  const streamers: RawStreamer[] = [];
  const seen = new Set<string>();

  // ── Phase 1: Live Polish streams ────────────────────────
  console.log('📺 Phase 1: Fetching LIVE Polish Twitch streams...');
  let cursor: string | undefined;

  while (streamers.length < maxResults) {
    const url = new URL('https://api.twitch.tv/helix/streams');
    url.searchParams.set('language', 'pl');
    url.searchParams.set('first', '100');
    if (cursor) url.searchParams.set('after', cursor);

    const data = await twitchGet(token, url.toString());
    if (!data.data?.length) break;

    const newStreams = data.data.filter((s: any) => !seen.has(s.user_id));
    newStreams.forEach((s: any) => seen.add(s.user_id));
    if (!newStreams.length) break;

    const profiles = await fetchTwitchUsers(token, newStreams.map((s: any) => s.user_id));

    for (const stream of newStreams) {
      const p = profiles.get(stream.user_id);
      streamers.push({
        slug: stream.user_login.toLowerCase(),
        name: stream.user_name,
        bio: p?.description || undefined,
        avatarUrl: p?.profile_image_url || undefined,
        bannerUrl: p?.offline_image_url || undefined,
        twitchUrl: `https://twitch.tv/${stream.user_login}`,
        twitchId: stream.user_id,
        followerCount: 0,
        viewCount: stream.viewer_count || 0,
      });
    }

    cursor = data.pagination?.cursor;
    console.log(`  Live: ${streamers.length} streamers (page: ${newStreams.length})`);
    if (!cursor) break;
    await sleep(100);
  }
  console.log(`  ✅ Phase 1 done: ${streamers.length} live streamers`);

  // ── Phase 2: Offline Polish streamers via Search ────────
  console.log('📺 Phase 2: Searching OFFLINE Polish Twitch channels...');

  const searchQueries = [
    'polski', 'polska', 'pl', 'stream', 'gry', 'gaming',
    'just chatting', 'league of legends', 'counter-strike', 'valorant',
    'minecraft', 'fortnite', 'gta', 'fifa', 'rocket league',
    'apex', 'dota', 'world of warcraft', 'hearthstone', 'overwatch',
    'dead by daylight', 'among us', 'roblox', 'rust', 'escape from tarkov',
    'irl', 'asmr', 'music', 'art', 'talk show',
    'twitch', 'streamer', 'rozrywka', 'humor', 'esport',
    'csgo', 'lol', 'pubg', 'warzone', 'diablo',
    'polski streamer', 'polskie', 'warsaw', 'krakow',
  ];

  for (const query of searchQueries) {
    if (streamers.length >= maxResults) break;
    let searchCursor: string | undefined;
    let pages = 0;

    while (pages < 5 && streamers.length < maxResults) {
      const url = new URL('https://api.twitch.tv/helix/search/channels');
      url.searchParams.set('query', query);
      url.searchParams.set('first', '100');
      url.searchParams.set('live_only', 'false');
      if (searchCursor) url.searchParams.set('after', searchCursor);

      const data = await twitchGet(token, url.toString());
      if (!data.data?.length) break;

      // Filter: only Polish broadcaster_language, not already seen
      const polish = data.data.filter((ch: any) =>
        ch.broadcaster_language === 'pl' && !seen.has(ch.id)
      );

      if (polish.length > 0) {
        // Fetch full user profiles
        const profiles = await fetchTwitchUsers(token, polish.map((ch: any) => ch.id));

        for (const ch of polish) {
          seen.add(ch.id);
          const p = profiles.get(ch.id);
          streamers.push({
            slug: ch.broadcaster_login.toLowerCase(),
            name: ch.display_name,
            bio: p?.description || undefined,
            avatarUrl: ch.thumbnail_url || p?.profile_image_url || undefined,
            bannerUrl: p?.offline_image_url || undefined,
            twitchUrl: `https://twitch.tv/${ch.broadcaster_login}`,
            twitchId: ch.id,
            followerCount: 0,
            viewCount: 0,
          });
        }
      }

      searchCursor = data.pagination?.cursor;
      pages++;
      if (!searchCursor) break;
      await sleep(120);
    }

    if (streamers.length % 500 < 50) {
      console.log(`  Search "${query}": total ${streamers.length} streamers`);
    }
  }

  console.log(`✅ Twitch total: ${streamers.length} Polish streamers (live + offline)`);
  return streamers;
}

// ═══════════════════════════════════════════════════════════
//  KICK — use app access token + lookup by slug
//  Strategy: check Twitch streamers' presence on Kick
//  + supplement with known Polish Kick streamer slugs
// ═══════════════════════════════════════════════════════════

async function getKickToken(): Promise<string> {
  const res = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: KICK_CLIENT_ID,
      client_secret: KICK_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Kick token fail: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function kickLookupSlugs(token: string, slugs: string[]): Promise<Map<string, any>> {
  const found = new Map<string, any>();

  // Kick allows up to 50 slugs per request
  for (let i = 0; i < slugs.length; i += 50) {
    const batch = slugs.slice(i, i + 50);
    const url = new URL('https://api.kick.com/public/v1/channels');
    batch.forEach(s => url.searchParams.append('slug', s));

    try {
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const ch of (data.data || [])) {
        found.set(ch.slug, ch);
      }
    } catch {}

    if (i % 500 === 0 && i > 0) console.log(`  Kick lookup: ${i}/${slugs.length}...`);
    await sleep(150); // rate limit
  }

  return found;
}

// Known Polish Kick streamers (supplement the cross-platform check)
const KNOWN_POLISH_KICK_SLUGS = [
  'ewron', 'xayoo', 'mandzio', 'overpow', 'mokebe', 'popo', 'kiszak',
  'medusa', 'friz', 'blowek', 'boxdel', 'junethack', 'banduracartel',
  'gimper', 'multi', 'nitro', 'rezigiusz', 'stepnpl', 'kacper-blonsky',
  'ambro', 'pelu', 'kubxd', 'cyber-marian', 'lord-kruszwil', 'wujek-bohansen',
  'czuux', 'nexe', 'mynthos', 'kangurek', 'adrian', 'szejansen',
  'qryjmq', 'flasjka', 'adamhurt', 'dieserben', 'winek', 'szafansen',
  'kamykaze', 'maro', 'maro-the-barber', 'endzior', 'emteerr', 'kruszwil',
  'yosi', 'isamu', 'dobrodansen', 'tojuzkoniec', 'blacha-live',
  'leh', 'odzansen', 'matimuharr', 'grubamruwa', 'karyna',
  'lehtansen', 'agnieszka-grzelak', 'szymus', 'kapelansen',
];

async function fetchKickStreamers(twitchSlugs: string[]): Promise<RawStreamer[]> {
  const token = await getKickToken();
  const streamers: RawStreamer[] = [];
  const seen = new Set<string>();

  console.log('🟢 Checking Kick for known Polish streamers...');

  // 1. Check Twitch slugs on Kick (many stream on both)
  const allSlugs = [...new Set([...KNOWN_POLISH_KICK_SLUGS, ...twitchSlugs])];
  console.log(`  Checking ${allSlugs.length} slugs on Kick...`);

  const channels = await kickLookupSlugs(token, allSlugs);

  for (const [slug, ch] of channels) {
    if (seen.has(slug)) continue;
    seen.add(slug);

    streamers.push({
      slug,
      name: slug,
      avatarUrl: undefined, // Kick channels endpoint doesn't return user avatar directly
      bannerUrl: ch.banner_picture || undefined,
      kickUrl: `https://kick.com/${slug}`,
      kickId: String(ch.broadcaster_user_id),
      followerCount: 0,
      viewCount: ch.stream?.viewer_count || 0,
    });
  }

  console.log(`✅ Kick: ${streamers.length} Polish streamers found`);
  return streamers;
}

// ═══════════════════════════════════════════════════════════
//  DATABASE UPSERT
// ═══════════════════════════════════════════════════════════

async function upsertStreamers(streamers: RawStreamer[]) {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  console.log(`\n💾 Upserting ${streamers.length} streamers into DB (batches of ${UPSERT_BATCH})...`);

  for (let i = 0; i < streamers.length; i += UPSERT_BATCH) {
    const batch = streamers.slice(i, i + UPSERT_BATCH);

    for (const s of batch) {
      try {
        // Check if exists by twitchId, kickId, or slug
        let existing = null;
        if (s.twitchId) {
          existing = await prisma.streamerProfile.findUnique({ where: { twitchId: s.twitchId } });
        }
        if (!existing && s.kickId) {
          existing = await prisma.streamerProfile.findUnique({ where: { kickId: s.kickId } });
        }
        if (!existing) {
          existing = await prisma.streamerProfile.findUnique({ where: { slug: s.slug } });
        }

        if (existing) {
          // Update: merge platform data
          const updateData: any = {};
          if (s.twitchId && !existing.twitchId) updateData.twitchId = s.twitchId;
          if (s.kickId && !existing.kickId) updateData.kickId = s.kickId;
          if (s.twitchUrl && !existing.twitchUrl) updateData.twitchUrl = s.twitchUrl;
          if (s.kickUrl && !existing.kickUrl) updateData.kickUrl = s.kickUrl;
          if (s.avatarUrl && !existing.avatarUrl) updateData.avatarUrl = s.avatarUrl;
          if (s.bannerUrl && !existing.bannerUrl) updateData.bannerUrl = s.bannerUrl;
          if (s.bio && !existing.bio) updateData.bio = s.bio;
          if (s.viewCount > existing.viewCount) updateData.viewCount = s.viewCount;

          if (Object.keys(updateData).length > 0) {
            await prisma.streamerProfile.update({
              where: { id: existing.id },
              data: updateData,
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Create new
          await prisma.streamerProfile.create({
            data: {
              slug: s.slug,
              name: s.name,
              bio: s.bio || null,
              avatarUrl: s.avatarUrl || null,
              bannerUrl: s.bannerUrl || null,
              twitchUrl: s.twitchUrl || null,
              kickUrl: s.kickUrl || null,
              twitchId: s.twitchId || null,
              kickId: s.kickId || null,
              followerCount: s.followerCount,
              viewCount: s.viewCount,
            },
          });
          created++;
        }
      } catch (err: any) {
        // Unique constraint violation — skip
        if (err.code === 'P2002') {
          skipped++;
        } else {
          console.error(`  ⚠ Error for ${s.slug}: ${err.message}`);
          skipped++;
        }
      }
    }

    console.log(`  Batch ${Math.floor(i / UPSERT_BATCH) + 1}: created=${created} updated=${updated} skipped=${skipped}`);
  }

  console.log(`\n✅ Done: ${created} created, ${updated} updated, ${skipped} skipped`);
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('🚀 Import Polish Streamers — Twitch + Kick');
  console.log(`   Max: ${MAX_TOTAL} | Batch: ${UPSERT_BATCH}\n`);

  // 1. Twitch — get all live Polish streams
  const twitchStreamers = await fetchTwitchStreamers(MAX_TOTAL);

  // 2. Kick — check which Twitch slugs exist on Kick + known Polish Kick slugs
  const twitchSlugs = twitchStreamers.map(s => s.slug);
  const kickStreamers = await fetchKickStreamers(twitchSlugs);

  // 3. Merge: combine Twitch and Kick data
  const merged = new Map<string, RawStreamer>();
  for (const s of twitchStreamers) {
    merged.set(s.slug, s);
  }
  for (const s of kickStreamers) {
    const existing = merged.get(s.slug);
    if (existing) {
      // Merge Kick data into Twitch entry
      existing.kickUrl = s.kickUrl;
      existing.kickId = s.kickId;
    } else {
      merged.set(s.slug, s);
    }
  }

  const all = Array.from(merged.values());
  console.log(`\n📊 Total merged: ${all.length} streamers`);

  // 4. Upsert
  await upsertStreamers(all);

  // 5. Stats
  const total = await prisma.streamerProfile.count();
  console.log(`\n📈 Total streamers in DB: ${total}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
