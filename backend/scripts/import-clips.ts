/**
 * Import clips from Twitch for streamer profiles.
 * 
 * Fetches top clips from Twitch Helix API for streamers in DB,
 * creates Post records (type=CLIP, clipSource=TWITCH), and auto-tags them.
 * 
 * Target: ~20,000 clips total
 * Usage: npx tsx scripts/import-clips.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';

const TARGET_CLIPS = 20000;
const AUTHOR_ID = 2; // admin user
const CLIPS_PER_STREAMER = 3; // top clips per streamer
const BATCH_SIZE = 50;

// ── Twitch game ID → tag mapping ──
const GAME_TAG_MAP: Record<string, string[]> = {
  '509658': ['irl', 'just-chatting'],
  '32982': ['gta', 'gaming'],
  '21779': ['lol', 'gaming', 'esports'],
  '516575': ['valorant', 'gaming', 'esports'],
  '33214': ['fortnite', 'gaming'],
  '32399': ['cs2', 'gaming', 'esports'],
  '263490': ['rust', 'gaming'],
  '27471': ['minecraft', 'gaming'],
  '511224': ['apex-legends', 'gaming'],
  '29595': ['dota2', 'gaming', 'esports'],
  '512710': ['call-of-duty', 'gaming'],
  '491487': ['dead-by-daylight', 'gaming', 'horror'],
  '518203': ['sports', 'gaming'],
  '515025': ['overwatch', 'gaming', 'esports'],
  '513143': ['teamfight-tactics', 'gaming'],
  '460630': ['rainbow-six', 'gaming'],
  '26936': ['music'],
  '509660': ['art', 'creative'],
  '512953': ['elden-ring', 'gaming'],
  '138585': ['hearthstone', 'gaming'],
  '18122': ['world-of-warcraft', 'gaming'],
  '65632': ['dota-underlords', 'gaming'],
  '493057': ['pubg', 'gaming'],
  '509659': ['asmr'],
  '65876': ['rocket-league', 'gaming'],
  '29307': ['path-of-exile', 'gaming'],
  '27546': ['world-of-warcraft', 'gaming'],
  '30921': ['rocket-league', 'gaming'],
  '490100': ['lost-ark', 'gaming'],
  '386821': ['black-desert', 'gaming'],
  '497057': ['destiny', 'gaming'],
  '509667': ['food-drink', 'irl'],
  '509670': ['science', 'irl'],
  '509673': ['travel', 'irl'],
  '417752': ['talk-shows', 'irl'],
  '26168': ['pokemon', 'gaming'],
};

// ── Keyword-based tag detection from clip titles ──
const TITLE_TAG_RULES: [RegExp, string[]][] = [
  [/\bfunny\b|\bfail\b|\blmao\b|\bromfl\b|\bxd\b|\bhilarious\b|\bsmieszne\b/i, ['humor']],
  [/\bclutch\b|\bace\b|\b1v[2-5]\b|\binsane\b|\bcrazy\b|\bpoggers\b|\bpog\b/i, ['highlights']],
  [/\brage\b|\bsalt\b|\btilt\b|\banger\b|\btoxic\b/i, ['rage']],
  [/\bjump\s?scare\b|\bhorror\b|\bscary\b/i, ['horror']],
  [/\bspeedrun\b|\bworld\s?record\b|\bwr\b|\bpb\b/i, ['speedrun']],
  [/\bchallenge\b|\bbet\b/i, ['challenge']],
  [/\bdrama\b|\bcontroversy\b|\bban\b|\bbanned\b/i, ['drama']],
  [/\breaction\b|\breact\b/i, ['reactions']],
  [/\bsong\b|\bmusic\b|\bsing\b|\bguitar\b|\bpiano\b|\bdj\b/i, ['music']],
  [/\banime\b|\bmanga\b|\bweeb\b|\botaku\b/i, ['anime']],
  [/\bvtuber\b|\bvirtual\b/i, ['vtuber']],
  [/\besport\b|\btournament\b|\bfinal\b|\bchampion\b|\bcompetitive\b/i, ['esports']],
  [/\bgta\b|\bgrand\s?theft/i, ['gta']],
  [/\bminecraft\b|\bmc\b/i, ['minecraft']],
  [/\bfortnite\b/i, ['fortnite']],
  [/\bvalorant\b|\bvalo\b/i, ['valorant']],
  [/\bcounter[\s-]?strike\b|\bcs2\b|\bcsgo\b|\bcs:go\b/i, ['cs2']],
  [/\bleague\b|\blol\b/i, ['lol']],
  [/\broblox\b/i, ['roblox']],
  [/\bamong\s?us\b/i, ['among-us']],
  [/\birl\b|\breal\s?life\b|\bout(side|doors)\b/i, ['irl']],
  [/\bcooking\b|\bcook\b|\bfood\b|\brecipe\b/i, ['cooking']],
  [/\bsport\b|\bfootball\b|\bsoccer\b|\bbasketball\b|\bnba\b/i, ['sport']],
];

let twitchToken = '';

async function getTwitchToken(): Promise<string> {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
  });
  const data = await res.json();
  return data.access_token;
}

async function twitchGet(url: string): Promise<any> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${twitchToken}`,
      },
    });
    if (res.status === 429) {
      const reset = res.headers.get('ratelimit-reset');
      const waitMs = reset ? (parseInt(reset) * 1000 - Date.now() + 1000) : 60000;
      console.log(`  ⏳ Rate limited, waiting ${Math.ceil(waitMs / 1000)}s...`);
      await new Promise(r => setTimeout(r, Math.max(waitMs, 5000)));
      continue;
    }
    if (res.status === 401) {
      twitchToken = await getTwitchToken();
      continue;
    }
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}

interface TwitchClip {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
}

function getClipVideoUrl(thumbnailUrl: string): string {
  // Twitch clip thumbnails follow pattern: ...-preview-480x272.jpg
  // The actual clip MP4 is at the same base URL with .mp4 extension
  const base = thumbnailUrl.replace(/-preview-\d+x\d+\.jpg$/, '.mp4');
  return base;
}

function autoTag(clip: TwitchClip): string[] {
  const tags = new Set<string>();
  tags.add('clip');
  tags.add('twitch');

  // Game-based tags
  if (clip.game_id && GAME_TAG_MAP[clip.game_id]) {
    GAME_TAG_MAP[clip.game_id].forEach(t => tags.add(t));
  } else if (clip.game_id) {
    tags.add('gaming');
  }

  // Title-based tags
  const title = clip.title || '';
  for (const [regex, tagNames] of TITLE_TAG_RULES) {
    if (regex.test(title)) {
      tagNames.forEach(t => tags.add(t));
    }
  }

  // Language-based tags
  const langTags: Record<string, string> = {
    en: 'english', es: 'spanish', pt: 'portuguese', de: 'german',
    fr: 'french', ko: 'korean', ja: 'japanese', ru: 'russian',
    it: 'italian', tr: 'turkish', zh: 'chinese', th: 'thai',
  };
  if (clip.language && langTags[clip.language]) {
    tags.add(langTags[clip.language]);
  }

  return Array.from(tags).slice(0, 8); // max 8 tags per clip
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

async function findOrCreateTags(names: string[]): Promise<number[]> {
  const tagIds: number[] = [];
  for (const name of names) {
    const slug = toSlug(name);
    if (!slug) continue;
    let tag = await prisma.tag.findUnique({ where: { slug } });
    if (!tag) {
      try {
        tag = await prisma.tag.create({ data: { name, slug } });
      } catch {
        tag = await prisma.tag.findUnique({ where: { slug } });
      }
    }
    if (tag) tagIds.push(tag.id);
  }
  return tagIds;
}

async function fetchClipsForStreamer(twitchId: string, count: number): Promise<TwitchClip[]> {
  const url = `https://api.twitch.tv/helix/clips?broadcaster_id=${twitchId}&first=${count}`;
  const data = await twitchGet(url);
  if (!data?.data) return [];
  return data.data;
}

async function main() {
  console.log('🎬 Twitch Clip Import');
  console.log('================================\n');

  twitchToken = await getTwitchToken();
  console.log('✅ Twitch token acquired\n');

  const existingClipCount = await prisma.post.count({ where: { type: 'CLIP' } });
  console.log(`Current clip count: ${existingClipCount}`);
  const needed = TARGET_CLIPS - existingClipCount;
  if (needed <= 0) {
    console.log(`Already have ${existingClipCount} clips. Target: ${TARGET_CLIPS}. Done!`);
    return;
  }
  console.log(`Need to import ~${needed} more clips to reach ${TARGET_CLIPS}\n`);

  // Get existing external IDs to avoid duplicates
  const existingExternalIds = new Set(
    (await prisma.post.findMany({
      where: { type: 'CLIP', clipSource: 'TWITCH', externalId: { not: null } },
      select: { externalId: true },
    })).map(p => p.externalId),
  );
  console.log(`Existing Twitch clip IDs in DB: ${existingExternalIds.size}`);

  // Get streamers with twitchId, ordered by follower count (best streamers = best clips)
  const streamers = await prisma.streamerProfile.findMany({
    where: { twitchId: { not: null } },
    select: { id: true, twitchId: true, name: true, slug: true },
    orderBy: { followerCount: 'desc' },
  });
  console.log(`Streamers with Twitch ID: ${streamers.length}\n`);

  // We need ~needed clips. At CLIPS_PER_STREAMER per streamer, process enough streamers.
  const streamersToProcess = Math.min(
    streamers.length,
    Math.ceil((needed * 1.5) / CLIPS_PER_STREAMER), // 1.5x buffer for dupes/empty
  );
  console.log(`Will process up to ${streamersToProcess} streamers (${CLIPS_PER_STREAMER} clips each)\n`);

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalEmpty = 0;
  let processedStreamers = 0;
  const startTime = Date.now();

  // Process streamers in batches
  for (let i = 0; i < streamersToProcess && totalCreated < needed; i += BATCH_SIZE) {
    const batch = streamers.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    console.log(`📦 Batch ${batchNum} (streamers ${i + 1}-${i + batch.length})...`);

    for (const streamer of batch) {
      if (totalCreated >= needed) break;
      
      const clips = await fetchClipsForStreamer(streamer.twitchId!, CLIPS_PER_STREAMER);
      
      if (clips.length === 0) {
        totalEmpty++;
        continue;
      }

      for (const clip of clips) {
        if (totalCreated >= needed) break;
        if (existingExternalIds.has(clip.id)) {
          totalSkipped++;
          continue;
        }

        const tagNames = autoTag(clip);
        const tagIds = await findOrCreateTags(tagNames);

        const videoUrl = clip.url; // Use Twitch clip URL
        const thumbnailUrl = clip.thumbnail_url;
        const title = clip.title.slice(0, 200) || `${streamer.name} clip`;

        try {
          await prisma.post.create({
            data: {
              authorId: AUTHOR_ID,
              streamerProfileId: streamer.id,
              title,
              content: `${title} — ${streamer.name} on Twitch`,
              type: 'CLIP',
              clipSource: 'TWITCH',
              videoUrl,
              thumbnailUrl,
              externalId: clip.id,
              duration: Math.round(clip.duration),
              viewCount: clip.view_count || 0,
              tags: {
                create: tagIds.map(tagId => ({
                  tag: { connect: { id: tagId } },
                })),
              },
            },
          });
          existingExternalIds.add(clip.id);
          totalCreated++;
        } catch (err: any) {
          if (err?.code === 'P2002') {
            totalSkipped++;
          } else {
            // Log but continue
            console.error(`  ⚠️ Error creating clip: ${err.message?.slice(0, 80)}`);
          }
        }
      }

      processedStreamers++;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const currentTotal = existingClipCount + totalCreated;
    console.log(`  ✅ Created: ${totalCreated} | Skipped: ${totalSkipped} | Empty: ${totalEmpty} | DB total: ${currentTotal} | ${elapsed}s`);
    
    if (totalCreated >= needed) {
      console.log(`\n🎯 Reached target of ${TARGET_CLIPS}!`);
      break;
    }
  }

  // Update tag post counts
  console.log('\n📊 Updating tag counts...');
  const allTags = await prisma.tag.findMany({ select: { id: true } });
  for (const tag of allTags) {
    const count = await prisma.postTag.count({ where: { tagId: tag.id } });
    await prisma.tag.update({ where: { id: tag.id }, data: { postCount: count } });
  }

  const finalClipCount = await prisma.post.count({ where: { type: 'CLIP' } });
  const finalTagCount = await prisma.tag.count();

  console.log('\n================================');
  console.log(`✅ Import complete!`);
  console.log(`   Created: ${totalCreated}`);
  console.log(`   Skipped: ${totalSkipped}`);
  console.log(`   Empty streamers: ${totalEmpty}`);
  console.log(`   Streamers processed: ${processedStreamers}`);
  console.log(`   Total clips in DB: ${finalClipCount}`);
  console.log(`   Total tags: ${finalTagCount}`);
  console.log(`   Target: ${TARGET_CLIPS}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
