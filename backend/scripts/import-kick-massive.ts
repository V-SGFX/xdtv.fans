/**
 * Import ~5000 Polish Kick streamers using multiple discovery methods.
 *
 * Usage:  npx tsx scripts/import-kick-massive.ts [target]
 *   default target: 5000
 *
 * Methods:
 *  1. Known Polish slugs (expanded list)
 *  2. Category-based browsing (gaming categories)
 *  3. Sequential ID scanning with Polish language filter
 *  4. Subcategory live stream scanning
 */

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const KICK_CLIENT_ID = process.env.KICK_CLIENT_ID!;
const KICK_CLIENT_SECRET = process.env.KICK_CLIENT_SECRET!;
const TARGET = parseInt(process.argv[2] || '5000', 10);
const BATCH_UPSERT = 500;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

if (!KICK_CLIENT_ID || !KICK_CLIENT_SECRET) {
  console.error('❌ KICK_CLIENT_ID / KICK_CLIENT_SECRET not set in .env');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════
//  KICK API
// ═══════════════════════════════════════════════════════════

let kickToken = '';
let tokenExpiry = 0;

async function getKickToken(): Promise<string> {
  if (kickToken && Date.now() < tokenExpiry) return kickToken;

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
  kickToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 60000;
  return kickToken;
}

async function kickGet(url: string, retries = 3): Promise<any> {
  const token = await getKickToken();
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 429) {
        const wait = Math.pow(2, attempt + 1) * 1000;
        console.log(`  ⏳ Rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        if (attempt < retries - 1) { await sleep(1000); continue; }
        return null;
      }
      return res.json();
    } catch (err) {
      if (attempt < retries - 1) { await sleep(1000); continue; }
      return null;
    }
  }
  return null;
}

interface KickChannel {
  broadcaster_user_id: number;
  slug: string;
  channel_description?: string;
  banner_picture?: string;
  stream_title?: string;
  stream?: {
    is_live: boolean;
    viewer_count: number;
    language: string;
  };
}

// ═══════════════════════════════════════════════════════════
//  KNOWN POLISH KICK SLUGS — massively expanded
// ═══════════════════════════════════════════════════════════

const POLISH_SLUGS = [
  // Top verified PL Kick
  'lequt', 'discokarol', 'rybsonlol', 'neexcsgo', 'pajalock',
  'ewron', 'xayoo', 'mandzio', 'overpow', 'mokebe', 'popo', 'kiszak',
  'medusa', 'friz', 'blowek', 'boxdel', 'junethack', 'banduracartel',
  'gimper', 'multi', 'nitro', 'rezigiusz', 'stepnpl',
  'ambro', 'pelu', 'kubxd', 'czuux', 'nexe', 'mynthos',
  'kangurek', 'szejansen', 'qryjmq', 'flasjka', 'adamhurt',
  'dieserben', 'winek', 'szafansen', 'kamykaze', 'maro',
  'endzior', 'emteerr', 'kruszwil', 'yosi', 'isamu',
  'dobrodansen', 'tojuzkoniec', 'karyna', 'szymus',

  // CS / esport PL
  'izakooo', 'pashabiceps', 'taz', 'neo-csgo', 'snax', 'byali',
  'michu', 'innocent', 'dycha', 'grim', 'szpero', 'jedqr',
  'loord', 'gruby', 'kuben', 'luq', 'rallen', 'snatchie',
  'hades', 'oskar', 'styko', 'mono',

  // LoL / esport PL
  'agrael', 'izak', 'jankos', 'selfmade', 'odoamne', 'vander',
  'mikyx', 'cinkrof', 'woolite', 'nervarien', 'saju',

  // Just Chatting / IRL PL
  'littlebigwhale', 'wujek-bohansen', 'matispure', 'rozbijacz',
  'thefridge', 'andziaks', 'wersow', 'lordkruszwil',
  'thecamels', 'bekieansen', 'matimuharr', 'leh', 'grubamruwa',

  // Variety / GTA / MC PL
  'mrbambampl', 'vertez', 'rezi', 'stuu', 'lukasiu',
  'bendixen', 'sitr0x', 'junajted', 'doknes', 'dograpp',
  'dzidzior', 'qbik', 'bonkol', 'rafonix', 'klocuch',
  'abstrachuje', 'banshee', 'skkf',

  // More Polish Kick names
  'gural', 'polak', 'polski', 'polishboy', 'polishgirl',
  'wariat', 'szalony', 'crazy', 'beast', 'propl',
  'gamingpl', 'plgaming', 'polskigaming', 'gamingpolska',
  'tibiapol', 'tibiapl', 'tibia', 'tibek', 'tibiapolska',
];

// ═══════════════════════════════════════════════════════════
//  KICK SUBCATEGORIES (games) — for browsing live streams
// ═══════════════════════════════════════════════════════════

const GAME_SUBCATEGORY_IDS = [
  // These are Kick subcategory IDs for popular games
  // The actual IDs need to be discovered via API
];

// ═══════════════════════════════════════════════════════════
//  DISCOVERY METHODS
// ═══════════════════════════════════════════════════════════

async function lookupSlugs(slugs: string[]): Promise<KickChannel[]> {
  const all: KickChannel[] = [];
  const unique = [...new Set(slugs.map(s => s.toLowerCase()))];
  console.log(`🔍 Phase 1: Looking up ${unique.length} known slugs...`);

  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url = new URL('https://api.kick.com/public/v1/channels');
    batch.forEach(s => url.searchParams.append('slug', s));

    const data = await kickGet(url.toString());
    if (data?.data) all.push(...data.data);

    if ((i + 50) % 200 === 0) console.log(`  ${Math.min(i + 50, unique.length)}/${unique.length}...`);
    await sleep(200);
  }

  console.log(`  ✅ Found ${all.length} valid channels from slugs`);
  return all;
}

async function discoverSubcategories(): Promise<{ id: number; slug: string; name: string }[]> {
  console.log('\n🎮 Discovering Kick subcategories...');
  const all: any[] = [];

  // Fetch subcategories (games list)
  const data = await kickGet('https://api.kick.com/public/v1/subcategories?limit=100');
  if (data?.data) {
    all.push(...data.data);
    console.log(`  Found ${all.length} subcategories`);
  }

  return all.map((s: any) => ({ id: s.id, slug: s.slug, name: s.name }));
}

async function fetchLiveStreamsByLanguage(): Promise<KickChannel[]> {
  console.log('\n📡 Phase 2: Fetching Polish live streams...');
  const all: KickChannel[] = [];
  let cursor: string | undefined;
  let pages = 0;

  // The Kick public API v1 livestreams endpoint
  while (pages < 100) { // max 100 pages
    let url = 'https://api.kick.com/public/v1/livestreams?language=pl&limit=100&sort=viewer_count';
    if (cursor) url += `&cursor=${cursor}`;

    const data = await kickGet(url);
    if (!data?.data?.length) break;

    for (const stream of data.data) {
      if (stream.channel) {
        all.push({
          broadcaster_user_id: stream.channel.broadcaster_user_id || stream.broadcaster_user_id,
          slug: stream.channel.slug || stream.slug,
          channel_description: stream.channel.channel_description,
          banner_picture: stream.channel.banner_picture,
          stream_title: stream.stream_title || stream.title,
          stream: {
            is_live: true,
            viewer_count: stream.viewer_count || 0,
            language: 'pl',
          },
        });
      } else {
        // Flat format — stream IS the channel info
        all.push({
          broadcaster_user_id: stream.broadcaster_user_id,
          slug: stream.slug,
          channel_description: stream.channel_description,
          banner_picture: stream.banner_picture,
          stream_title: stream.stream_title,
          stream: {
            is_live: true,
            viewer_count: stream.viewer_count || 0,
            language: 'pl',
          },
        });
      }
    }

    cursor = data.cursor || data.next_cursor;
    if (!cursor) break;
    pages++;
    console.log(`  Page ${pages}: ${all.length} streams...`);
    await sleep(250);
  }

  console.log(`  ✅ Found ${all.length} Polish live streams`);
  return all;
}

async function fetchCategoryStreams(subcategoryId: number, subcategoryName: string): Promise<KickChannel[]> {
  const all: KickChannel[] = [];
  let cursor: string | undefined;
  let pages = 0;

  // Fetch live streams for a specific game/category, filter for Polish
  while (pages < 20) {
    let url = `https://api.kick.com/public/v1/subcategories/${subcategoryId}/livestreams?limit=100&sort=viewer_count`;
    if (cursor) url += `&cursor=${cursor}`;

    const data = await kickGet(url);
    if (!data?.data?.length) break;

    for (const stream of data.data) {
      const lang = stream.language?.toLowerCase() || '';
      const title = (stream.stream_title || '').toLowerCase();
      const desc = (stream.channel_description || '').toLowerCase();

      const isPolish = lang === 'pl' || lang === 'polish' ||
        title.includes('polski') || title.includes('polska') || title.includes('[pl]') ||
        title.includes('po polsku') || desc.includes('polski') || desc.includes('polska');

      if (isPolish) {
        all.push({
          broadcaster_user_id: stream.broadcaster_user_id || stream.channel?.broadcaster_user_id,
          slug: stream.slug || stream.channel?.slug,
          channel_description: stream.channel_description || stream.channel?.channel_description,
          banner_picture: stream.banner_picture || stream.channel?.banner_picture,
          stream_title: stream.stream_title,
          stream: { is_live: true, viewer_count: stream.viewer_count || 0, language: 'pl' },
        });
      }
    }

    cursor = data.cursor || data.next_cursor;
    if (!cursor) break;
    pages++;
    await sleep(250);
  }

  return all;
}

async function scanKickIds(startId: number, count: number): Promise<KickChannel[]> {
  const all: KickChannel[] = [];
  console.log(`\n🔢 Phase 3: Scanning Kick IDs ${startId}..${startId + count}...`);

  for (let i = startId; i < startId + count; i += 50) {
    const batch = Array.from({ length: Math.min(50, startId + count - i) }, (_, k) => i + k);
    const url = new URL('https://api.kick.com/public/v1/channels');
    batch.forEach(id => url.searchParams.append('broadcaster_user_id', String(id)));

    const data = await kickGet(url.toString());
    if (data?.data) {
      for (const ch of data.data) {
        const desc = (ch.channel_description || '').toLowerCase();
        const title = (ch.stream_title || '').toLowerCase();
        const lang = ch.stream?.language?.toLowerCase() || '';
        const slug = (ch.slug || '').toLowerCase();

        const isPolish = lang === 'pl' || lang === 'polish' ||
          desc.includes('polski') || desc.includes('polska') || desc.includes('po polsku') ||
          title.includes('polski') || title.includes('polska') || title.includes('[pl]') ||
          title.includes('po polsku') ||
          // Check for Polish characters in description
          /[ąćęłńóśźż]/.test(desc) || /[ąćęłńóśźż]/.test(title);

        if (isPolish) all.push(ch);
      }
    }

    const scanned = i - startId + 50;
    if (scanned % 1000 === 0) {
      console.log(`  Scanned ${scanned}/${count} IDs → ${all.length} Polish channels`);
    }
    await sleep(200);
  }

  console.log(`  ✅ ID scan found ${all.length} Polish channels`);
  return all;
}

// ═══════════════════════════════════════════════════════════
//  UPSERT
// ═══════════════════════════════════════════════════════════

async function upsertChannels(channels: KickChannel[]): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0, updated = 0, skipped = 0;

  for (const ch of channels) {
    if (!ch.broadcaster_user_id || !ch.slug) { skipped++; continue; }

    const kickId = String(ch.broadcaster_user_id);
    const slug = ch.slug.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);
    if (!slug) { skipped++; continue; }

    try {
      let existing = await prisma.streamerProfile.findUnique({ where: { kickId } });
      if (!existing) {
        existing = await prisma.streamerProfile.findUnique({ where: { slug } });
      }

      if (existing) {
        const updateData: any = {};
        if (!existing.kickId) updateData.kickId = kickId;
        if (!existing.kickUrl) updateData.kickUrl = `https://kick.com/${slug}`;
        if (ch.banner_picture && !existing.bannerUrl) updateData.bannerUrl = ch.banner_picture;
        if (ch.channel_description && !existing.bio) updateData.bio = ch.channel_description.slice(0, 500);
        if (ch.stream?.is_live) updateData.isLive = true;

        if (Object.keys(updateData).length > 0) {
          await prisma.streamerProfile.update({ where: { id: existing.id }, data: updateData });
          updated++;
        } else {
          skipped++;
        }
      } else {
        await prisma.streamerProfile.create({
          data: {
            slug,
            name: ch.slug, // keep original casing
            bio: ch.channel_description?.slice(0, 500) || null,
            bannerUrl: ch.banner_picture || null,
            kickUrl: `https://kick.com/${slug}`,
            kickId,
            isLive: ch.stream?.is_live || false,
            viewCount: ch.stream?.viewer_count || 0,
          },
        });
        created++;
      }
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Slug collision → try with suffix
        try {
          await prisma.streamerProfile.create({
            data: {
              slug: `${slug}-kick`,
              name: ch.slug,
              bio: ch.channel_description?.slice(0, 500) || null,
              bannerUrl: ch.banner_picture || null,
              kickUrl: `https://kick.com/${slug}`,
              kickId,
              isLive: ch.stream?.is_live || false,
              viewCount: ch.stream?.viewer_count || 0,
            },
          });
          created++;
        } catch {
          skipped++;
        }
      } else {
        skipped++;
      }
    }
  }

  return { created, updated, skipped };
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('🟢 Kick Massive Polish Streamer Import');
  console.log(`   Target: ~${TARGET}\n`);

  const allChannels = new Map<number, KickChannel>();

  // Phase 1: Known slugs
  const slugChannels = await lookupSlugs(POLISH_SLUGS);
  slugChannels.forEach(ch => allChannels.set(ch.broadcaster_user_id, ch));
  console.log(`📊 After slugs: ${allChannels.size} unique channels`);

  // Phase 2: Polish live streams
  const liveChannels = await fetchLiveStreamsByLanguage();
  liveChannels.forEach(ch => {
    if (ch.broadcaster_user_id && !allChannels.has(ch.broadcaster_user_id)) {
      allChannels.set(ch.broadcaster_user_id, ch);
    }
  });
  console.log(`📊 After live streams: ${allChannels.size} unique channels`);

  // Phase 3: Browse gaming categories for Polish streamers
  const subcategories = await discoverSubcategories();
  const gamingCats = subcategories.filter(s =>
    ['games', 'gaming', 'just chatting', 'irl'].some(k => s.name.toLowerCase().includes(k)) ||
    s.slug.includes('game') || s.slug.includes('just-chatting')
  );

  if (gamingCats.length > 0) {
    console.log(`\n🎮 Phase 2b: Scanning ${gamingCats.length} gaming categories for Polish streams...`);
    for (const cat of gamingCats.slice(0, 30)) { // top 30 categories
      const catChannels = await fetchCategoryStreams(cat.id, cat.name);
      catChannels.forEach(ch => {
        if (ch.broadcaster_user_id && !allChannels.has(ch.broadcaster_user_id)) {
          allChannels.set(ch.broadcaster_user_id, ch);
        }
      });
      if (catChannels.length > 0) console.log(`   ${cat.name}: +${catChannels.length} Polish`);
    }
    console.log(`📊 After categories: ${allChannels.size} unique channels`);
  }

  // Phase 4: ID scanning — scan ranges where Polish users tend to be
  // Start with dense ranges and expand
  const idRanges = [
    [1, 10000],
    [10000, 30000],
    [30000, 60000],
    [60000, 100000],
    [100000, 200000],
    [200000, 400000],
    [400000, 600000],
    [600000, 800000],
  ];

  for (const [start, end] of idRanges) {
    if (allChannels.size >= TARGET) break;
    const count = end - start;
    const idChannels = await scanKickIds(start, count);
    idChannels.forEach(ch => {
      if (ch.broadcaster_user_id && !allChannels.has(ch.broadcaster_user_id)) {
        allChannels.set(ch.broadcaster_user_id, ch);
      }
    });
    console.log(`📊 After IDs ${start}-${end}: ${allChannels.size} unique channels`);
  }

  console.log(`\n📋 Total discovered: ${allChannels.size} unique Polish Kick channels\n`);

  // Upsert in batches
  const channelArr = Array.from(allChannels.values());
  let totalCreated = 0, totalUpdated = 0, totalSkipped = 0;

  for (let i = 0; i < channelArr.length; i += BATCH_UPSERT) {
    const batch = channelArr.slice(i, i + BATCH_UPSERT);
    console.log(`💾 Upserting batch ${Math.floor(i / BATCH_UPSERT) + 1} (${batch.length} channels)...`);
    const result = await upsertChannels(batch);
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    console.log(`   +${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
  }

  const total = await prisma.streamerProfile.count();
  const kickOnly = await prisma.streamerProfile.count({ where: { kickId: { not: null }, twitchId: null } });

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ Kick Import Complete!`);
  console.log(`   Discovered: ${allChannels.size}`);
  console.log(`   Created: ${totalCreated}`);
  console.log(`   Updated: ${totalUpdated}`);
  console.log(`   Skipped: ${totalSkipped}`);
  console.log(`   Total in DB: ${total} (${kickOnly} Kick-only)`);
  console.log('═══════════════════════════════════════');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
