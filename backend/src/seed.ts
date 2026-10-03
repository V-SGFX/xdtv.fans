import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@xdtv.fans';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) throw new Error('Ustaw SEED_ADMIN_PASSWORD w .env');
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      username: 'admin',
      passwordHash,
      displayName: 'Admin',
      role: 'ADMIN',
    },
  });

  const streamers = [
    { slug: 'xqc', name: 'xQc', bio: 'Félix Lengyel – Canadian Twitch streamer', twitchUrl: 'https://twitch.tv/xqc' },
    { slug: 'pokimane', name: 'Pokimane', bio: 'Imane Anys – Moroccan-Canadian internet personality', twitchUrl: 'https://twitch.tv/pokimane' },
  ];

  for (const s of streamers) {
    const profile = await prisma.streamerProfile.upsert({
      where: { slug: s.slug },
      update: {},
      create: s,
    });

    await prisma.channel.upsert({
      where: { scope_streamerProfileId_slug: { scope: 'STREAMER', streamerProfileId: profile.id, slug: 'general' } },
      update: {},
      create: { scope: 'STREAMER', streamerProfileId: profile.id, name: 'General', slug: 'general', type: 'PUBLIC' },
    });
  }

  console.log('Seed complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
