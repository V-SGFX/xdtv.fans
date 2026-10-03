import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Assigns tags to existing clips based on:
 * - clipSource (youtube, twitch, tiktok, kick)
 * - Title keywords (#shorts, minecraft, gaming, etc.)
 * - Streamer category patterns
 */

const KEYWORD_TAGS: [RegExp, string][] = [
  [/#shorts|#short/i, 'shorts'],
  [/minecraft/i, 'minecraft'],
  [/fortnite/i, 'fortnite'],
  [/valorant/i, 'valorant'],
  [/cs2|counter.?strike|csgo/i, 'cs2'],
  [/league.?of.?legends|lol/i, 'lol'],
  [/gta/i, 'gta'],
  [/roblox/i, 'roblox'],
  [/among.?us/i, 'among-us'],
  [/horror|straszn|scary/i, 'horror'],
  [/funny|śmiesz|beka|zabawn|komedi|humor/i, 'humor'],
  [/drama/i, 'drama'],
  [/reaction|reakcj|ogląda/i, 'reakcje'],
  [/challenge|wyzwani/i, 'challenge'],
  [/irl|vlog/i, 'irl'],
  [/music|muzyk|song|piosenk|rap|hip.?hop/i, 'muzyka'],
  [/anime|manga/i, 'anime'],
  [/cooking|gotowa|kuchni|jedzeni|food/i, 'gotowanie'],
  [/sport|piłk|football|koszykówk|basketball/i, 'sport'],
  [/tiktok|tikto/i, 'tiktok'],
];

const SOURCE_TAG_MAP: Record<string, string> = {
  YOUTUBE: 'youtube',
  TWITCH: 'twitch',
  TIKTOK: 'tiktok',
  KICK: 'kick',
};

async function ensureTag(slug: string, name?: string): Promise<number> {
  const existing = await prisma.tag.findUnique({ where: { slug } });
  if (existing) return existing.id;
  const tag = await prisma.tag.create({
    data: { slug, name: name || slug },
  });
  return tag.id;
}

async function main() {
  console.log('🏷️  Starting clip tag assignment...');

  // Pre-create all tags we might need
  const tagCache = new Map<string, number>();
  const allSlugs = [
    ...Object.values(SOURCE_TAG_MAP),
    ...KEYWORD_TAGS.map(([, slug]) => slug),
    'clip', 'gaming', 'rozrywka',
  ];

  for (const slug of [...new Set(allSlugs)]) {
    tagCache.set(slug, await ensureTag(slug));
  }

  // Fetch all clips without tags (or all clips)
  const clips = await prisma.post.findMany({
    where: { type: 'CLIP', isDeleted: false },
    select: {
      id: true,
      title: true,
      content: true,
      clipSource: true,
      videoUrl: true,
      streamerProfileId: true,
      tags: { select: { tagId: true } },
    },
  });

  console.log(`📋 Found ${clips.length} clips total`);

  let tagged = 0;
  let skipped = 0;

  for (const clip of clips) {
    // Skip clips that already have tags
    if (clip.tags.length > 0) {
      skipped++;
      continue;
    }

    const tagIds = new Set<number>();

    // 1. Add "clip" tag to all
    tagIds.add(tagCache.get('clip')!);

    // 2. Add source-based tag
    if (clip.clipSource && SOURCE_TAG_MAP[clip.clipSource]) {
      tagIds.add(tagCache.get(SOURCE_TAG_MAP[clip.clipSource])!);
    }

    // 3. Check title for keyword-based tags
    const text = `${clip.title} ${clip.content || ''}`;
    for (const [pattern, slug] of KEYWORD_TAGS) {
      if (pattern.test(text)) {
        tagIds.add(tagCache.get(slug)!);
      }
    }

    // 4. If YouTube shorts is detected (URL pattern or title)
    if (clip.videoUrl?.includes('/shorts/') || /#shorts/i.test(clip.title)) {
      tagIds.add(tagCache.get('shorts')!);
    }

    // 5. General category: if has game keywords → "gaming", else → "rozrywka"
    const hasGaming = /minecraft|fortnite|valorant|cs2|csgo|lol|gta|roblox|game|gra|gracz/i.test(text);
    if (hasGaming) {
      tagIds.add(tagCache.get('gaming')!);
    } else {
      tagIds.add(tagCache.get('rozrywka')!);
    }

    // Insert the post_tags
    if (tagIds.size > 0) {
      await prisma.postTag.createMany({
        data: [...tagIds].map(tagId => ({ postId: clip.id, tagId })),
        skipDuplicates: true,
      });
      tagged++;
    }
  }

  // Update tag post counts
  const allTagIds = [...tagCache.values()];
  for (const tagId of allTagIds) {
    const count = await prisma.postTag.count({ where: { tagId } });
    await prisma.tag.update({
      where: { id: tagId },
      data: { postCount: count },
    });
  }

  console.log(`✅ Tagged ${tagged} clips, skipped ${skipped} (already had tags)`);
  console.log('📊 Tag counts:');
  const tags = await prisma.tag.findMany({
    where: { id: { in: allTagIds } },
    orderBy: { postCount: 'desc' },
  });
  for (const t of tags) {
    console.log(`   ${t.slug}: ${t.postCount}`);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
