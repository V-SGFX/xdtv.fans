/**
 * Import Kick streamers by cross-referencing existing Twitch streamer slugs.
 *
 * We have ~19k Polish Twitch streamers. Many will have matching Kick accounts.
 * The Kick API allows looking up channels by slug (50 per request).
 *
 * Usage:  npx tsx scripts/import-kick-crossref.ts [batchSize]
 *   default batch: 500
 *
 * Strategy:
 *   1. Take all existing streamer slugs from DB (Twitch profiles)
 *   2. Look them up on Kick API in batches of 50
 *   3. Merge matches: add kickId/kickUrl to existing profiles
 *   4. Also check live Polish Kick streams for new channels
 */

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const KICK_CLIENT_ID = process.env.KICK_CLIENT_ID!;
const KICK_CLIENT_SECRET = process.env.KICK_CLIENT_SECRET!;
const BATCH_SIZE = parseInt(process.argv[2] || '500', 10);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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

async function kickGet(url: string): Promise<any> {
  const token = await getKickToken();
  for (let attempt = 0; attempt < 3; attempt++) {
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
      if (!res.ok) return null;
      return res.json();
    } catch {
      await sleep(1000);
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
//  PHASE 1: Cross-reference Twitch slugs with Kick
// ═══════════════════════════════════════════════════════════

async function crossRefSlugs(): Promise<{ matched: number; newKick: number }> {
  // Get all streamers that DON'T have kickId yet
  const streamers = await prisma.streamerProfile.findMany({
    where: { kickId: null },
    select: { id: true, slug: true, name: true },
    orderBy: { followerCount: 'desc' },
  });

  console.log(`📋 ${streamers.length} streamers without kickId to check\n`);

  let matched = 0;
  let newKick = 0;
  let checked = 0;

  for (let i = 0; i < streamers.length; i += 50) {
    const batch = streamers.slice(i, i + 50);
    const slugs = batch.map(s => s.slug.toLowerCase());

    const url = new URL('https://api.kick.com/public/v1/channels');
    slugs.forEach(s => url.searchParams.append('slug', s));

    const data = await kickGet(url.toString());
    checked += batch.length;

    if (data?.data) {
      for (const ch of data.data) {
        const kickId = String(ch.broadcaster_user_id);
        const kickSlug = ch.slug.toLowerCase();

        // Find matching DB profile
        const dbProfile = batch.find(s => s.slug.toLowerCase() === kickSlug);

        if (dbProfile) {
          // Exact slug match → update existing profile with Kick data
          try {
            await prisma.streamerProfile.update({
              where: { id: dbProfile.id },
              data: {
                kickId,
                kickUrl: `https://kick.com/${kickSlug}`,
                ...(ch.banner_picture ? { bannerUrl: ch.banner_picture } : {}),
                ...(ch.channel_description ? { bio: ch.channel_description.slice(0, 500) } : {}),
              },
            });
            matched++;
          } catch (err: any) {
            if (err.code === 'P2002') {
              // kickId already used by another profile
            }
          }
        } else {
          // Kick channel found but slug doesn't match exactly — create new
          const existing = await prisma.streamerProfile.findUnique({ where: { kickId } });
          if (!existing) {
            const slugExists = await prisma.streamerProfile.findUnique({ where: { slug: kickSlug } });
            if (!slugExists) {
              try {
                await prisma.streamerProfile.create({
                  data: {
                    slug: kickSlug,
                    name: ch.slug,
                    bio: ch.channel_description?.slice(0, 500) || null,
                    bannerUrl: ch.banner_picture || null,
                    kickUrl: `https://kick.com/${kickSlug}`,
                    kickId,
                    isLive: ch.stream?.is_live || false,
                    viewCount: ch.stream?.viewer_count || 0,
                  },
                });
                newKick++;
              } catch {}
            }
          }
        }
      }
    }

    if (checked % BATCH_SIZE === 0) {
      console.log(`  Checked ${checked}/${streamers.length} → ${matched} matched, ${newKick} new Kick-only`);
    }

    await sleep(200);
  }

  console.log(`\n  ✅ Cross-ref complete: ${matched} matched, ${newKick} new Kick-only`);
  return { matched, newKick };
}

// ═══════════════════════════════════════════════════════════
//  PHASE 2: Fetch all Polish live Kick streams
// ═══════════════════════════════════════════════════════════

async function fetchPolishLiveStreams(): Promise<number> {
  console.log('\n📡 Phase 2: Fetching all Polish live Kick streams...');
  let created = 0;
  let updated = 0;
  let cursor: string | undefined;
  let page = 0;

  while (page < 200) {
    let url = 'https://api.kick.com/public/v1/livestreams?language=pl&limit=100&sort=viewer_count';
    if (cursor) url += `&cursor=${cursor}`;

    const data = await kickGet(url);
    if (!data?.data?.length) break;

    for (const stream of data.data) {
      const kickId = String(stream.broadcaster_user_id || stream.channel?.broadcaster_user_id);
      const slug = (stream.slug || stream.channel?.slug || '').toLowerCase();
      if (!kickId || !slug) continue;

      try {
        let existing = await prisma.streamerProfile.findUnique({ where: { kickId } });
        if (!existing) existing = await prisma.streamerProfile.findUnique({ where: { slug } });

        if (existing) {
          const upd: any = {};
          if (!existing.kickId) upd.kickId = kickId;
          if (!existing.kickUrl) upd.kickUrl = `https://kick.com/${slug}`;
          upd.isLive = true;
          if (Object.keys(upd).length > 0) {
            await prisma.streamerProfile.update({ where: { id: existing.id }, data: upd });
            updated++;
          }
        } else {
          await prisma.streamerProfile.create({
            data: {
              slug,
              name: stream.slug || slug,
              bio: (stream.channel_description || stream.channel?.channel_description || '').slice(0, 500) || null,
              bannerUrl: stream.banner_picture || stream.channel?.banner_picture || null,
              kickUrl: `https://kick.com/${slug}`,
              kickId,
              isLive: true,
              viewCount: stream.viewer_count || 0,
            },
          });
          created++;
        }
      } catch {}
    }

    cursor = data.cursor || data.next_cursor;
    if (!cursor) break;
    page++;
    if (page % 5 === 0) console.log(`  Page ${page}: ${created} created, ${updated} updated`);
    await sleep(250);
  }

  console.log(`  ✅ Live streams: ${created} created, ${updated} updated`);
  return created;
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  const startKick = await prisma.streamerProfile.count({ where: { kickId: { not: null } } });
  console.log('🟢 Kick Cross-Reference Import');
  console.log(`   Current Kick profiles: ${startKick}`);
  console.log(`   Batch size: ${BATCH_SIZE}\n`);

  // Phase 1: Cross-reference existing Twitch slugs
  console.log('═══ PHASE 1: Cross-reference Twitch slugs on Kick ═══');
  const { matched, newKick } = await crossRefSlugs();

  // Phase 2: Polish live streams discovery
  console.log('\n═══ PHASE 2: Polish live Kick streams ═══');
  const liveCreated = await fetchPolishLiveStreams();

  // Final stats
  const endKick = await prisma.streamerProfile.count({ where: { kickId: { not: null } } });
  const total = await prisma.streamerProfile.count();

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ Kick Import Complete!`);
  console.log(`   Kick before: ${startKick}`);
  console.log(`   Kick after: ${endKick} (+${endKick - startKick})`);
  console.log(`   - Twitch→Kick matched: ${matched}`);
  console.log(`   - New Kick-only: ${newKick}`);
  console.log(`   - Live stream discovery: ${liveCreated}`);
  console.log(`   Total in DB: ${total}`);
  console.log('═══════════════════════════════════════');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
