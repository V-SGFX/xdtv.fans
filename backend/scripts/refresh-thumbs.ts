/**
 * One-off backlog run of the weekly clip-thumbnail refresh.
 *
 * Plain Prisma + fetch rather than a Nest standalone context: bootstrapping
 * AppModule pulls in Redis, BullMQ and the schedulers, which is a lot of
 * machinery for a script that only needs the database and the Twitch API.
 * The logic mirrors PlatformSyncService.refreshTwitchClipThumbnails.
 */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function twitchToken(): Promise<string> {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: 'client_credentials',
    }),
  });
  return (await res.json()).access_token;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const token = await twitchToken();
  if (!token) throw new Error('no twitch token');
  const clientId = process.env.TWITCH_CLIENT_ID!;

  const clips = await prisma.post.findMany({
    where: { type: 'CLIP', clipSource: 'TWITCH', isDeleted: false, externalId: { not: null } },
    select: { id: true, externalId: true, thumbnailUrl: true },
  });
  console.log(`checking ${clips.length} clips`);

  let updated = 0, cleared = 0, batches = 0;
  for (const batch of chunk(clips, 100)) {
    const qs = batch.map((c) => `id=${encodeURIComponent(c.externalId!)}`).join('&');
    const live: Record<string, string> = {};
    try {
      const res = await fetch(`https://api.twitch.tv/helix/clips?${qs}`, {
        headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId },
      });
      if (!res.ok) { console.warn(`batch HTTP ${res.status}`); continue; }
      const data = await res.json();
      for (const c of data.data || []) if (c.id && c.thumbnail_url) live[c.id] = c.thumbnail_url;
    } catch (e) { console.warn('batch error', (e as Error).message); continue; }

    for (const clip of batch) {
      const fresh = live[clip.externalId!];
      if (fresh && fresh !== clip.thumbnailUrl) {
        await prisma.post.update({ where: { id: clip.id }, data: { thumbnailUrl: fresh } });
        updated++;
      } else if (!fresh && clip.thumbnailUrl) {
        await prisma.post.update({ where: { id: clip.id }, data: { thumbnailUrl: null } });
        cleared++;
      }
    }
    if (++batches % 20 === 0) console.log(`  ${batches * 100} checked — ${updated} refreshed, ${cleared} cleared`);
  }

  console.log(`DONE: ${clips.length} checked, ${updated} refreshed, ${cleared} cleared`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
