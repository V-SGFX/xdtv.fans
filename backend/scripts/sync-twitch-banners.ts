/**
 * One-time script to fetch offline_image_url (bannerUrl) from Twitch
 * for all streamers that have a twitchId but no bannerUrl.
 *
 * Usage: npx tsx scripts/sync-twitch-banners.ts
 */
import { PrismaClient } from '@prisma/client';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';

const prisma = new PrismaClient();

async function getTwitchAppToken(): Promise<string> {
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
  if (!data.access_token) throw new Error('Failed to get Twitch token');
  return data.access_token;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function main() {
  // Get all streamers with twitchId but no banner
  const streamers = await prisma.streamerProfile.findMany({
    where: {
      twitchId: { not: null },
      bannerUrl: null,
    },
    select: { id: true, twitchId: true, name: true },
  });

  console.log(`Found ${streamers.length} streamers without bannerUrl`);
  if (streamers.length === 0) return;

  const token = await getTwitchAppToken();
  console.log('Got Twitch app token');

  let updated = 0;
  let skipped = 0;

  // Twitch API allows up to 100 user IDs per request
  const batches = chunk(streamers, 100);
  for (const batch of batches) {
    const ids = batch.map(s => `id=${s.twitchId}`).join('&');
    const res = await fetch(`https://api.twitch.tv/helix/users?${ids}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': TWITCH_CLIENT_ID,
      },
    });
    const data = await res.json();

    if (!data.data) {
      console.error('Twitch API error:', data);
      continue;
    }

    const userMap = new Map<string, any>();
    for (const user of data.data) {
      userMap.set(user.id, user);
    }

    for (const streamer of batch) {
      const twitchUser = userMap.get(streamer.twitchId!);
      if (!twitchUser) {
        skipped++;
        continue;
      }

      const bannerUrl = twitchUser.offline_image_url || null;
      const avatarUrl = twitchUser.profile_image_url || null;

      // Update bannerUrl and avatarUrl (refresh avatar too)
      const updateData: any = {};
      if (bannerUrl) updateData.bannerUrl = bannerUrl;
      if (avatarUrl) updateData.avatarUrl = avatarUrl;

      if (Object.keys(updateData).length > 0) {
        await prisma.streamerProfile.update({
          where: { id: streamer.id },
          data: updateData,
        });
        updated++;
        if (bannerUrl) {
          console.log(`✓ ${streamer.name}: banner set`);
        } else {
          console.log(`~ ${streamer.name}: avatar refreshed (no banner on Twitch)`);
        }
      } else {
        skipped++;
      }
    }

    // Small delay between batches
    if (batches.length > 1) await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
