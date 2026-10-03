import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.channel.findMany({
    where: { scope: 'GLOBAL' },
    select: { slug: true, name: true },
  });
  console.log('Existing global channels:', existing);

  const channels = [
    { name: 'General', slug: 'general', description: 'Ogólna rozmowa', sortOrder: 0 },
    { name: 'Drama', slug: 'drama', description: 'Dramaty i kontrowersje', sortOrder: 3 },
    { name: 'Gaming', slug: 'gaming', description: 'Gry i gameplay', sortOrder: 4 },
    { name: 'AMA', slug: 'ama', description: 'Ask Me Anything — pytania i odpowiedzi', sortOrder: 5 },
  ];

  for (const ch of channels) {
    const exists = existing.find((e) => e.slug === ch.slug);
    if (!exists) {
      await prisma.channel.create({
        data: { scope: 'GLOBAL', type: 'PUBLIC', ...ch },
      });
      console.log('Created:', ch.slug);
    } else {
      console.log('Already exists:', ch.slug);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
