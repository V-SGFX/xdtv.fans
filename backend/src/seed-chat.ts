/**
 * Seed script: populate chat channels with natural-looking messages
 * from a few fake users to make the chat feel alive.
 *
 * Usage: npx tsx src/seed-chat.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

/* ── Fake users that will "author" the seed messages ── */
const FAKE_USERS = [
  { username: 'kuba_xd', displayName: 'Kuba', email: 'kuba_seed@xdtv.local' },
  { username: 'ania123', displayName: 'ania123', email: 'ania_seed@xdtv.local' },
  { username: 'lurkmaster', displayName: 'LurkMaster', email: 'lurk_seed@xdtv.local' },
  { username: 'wiktor_gg', displayName: 'wiktor', email: 'wiktor_seed@xdtv.local' },
];

/* ── Channel slug → list of messages ── */
const SEED_MESSAGES: { channel: string; content: string }[] = [
  // General — opinions
  { channel: 'general', content: 'Polecam sprawdzić nową stronę, wygląda mega' },
  { channel: 'general', content: 'Ktoś wie czy dzisiaj coś ciekawego lecieli?' },
  { channel: 'general', content: 'imo najlepsze community w polskim internecie 💜' },
  { channel: 'general', content: 'Wreszcie miejsce gdzie można normalnie pogadać bez toxica' },
  { channel: 'general', content: 'Siema, drugi dzień tutaj. Podoba mi się' },

  // General — questions
  { channel: 'general', content: 'Jak zacząć streamować? Ma ktoś poradnik?' },
  { channel: 'general', content: 'Od kiedy działa ten czat? Dopiero odkryłem' },
  { channel: 'general', content: 'Kto tu jest adminem? Chciałbym zgłosić pomysł' },

  // Drama
  { channel: 'drama', content: 'Ta drama z zeszłego tygodnia to był peak content ngl' },
  { channel: 'drama', content: 'Ktoś jeszcze pamięta tamtą aferę? Do dzisiaj się śmieję 💀' },
  { channel: 'drama', content: 'Unpopular opinion: większość dram jest ustawiona dla contentu' },
  { channel: 'drama', content: 'Ok ale kto miał rację w tamtym beefie? Bo ja dalej nie wiem' },

  // Gaming
  { channel: 'gaming', content: 'Ktoś gra w nowy patch? Jest taki broken 😂' },
  { channel: 'gaming', content: 'Szukam ekipy do grania wieczorem, ktoś chętny?' },
  { channel: 'gaming', content: 'Hot take: lethal company > phasmophobia' },
  { channel: 'gaming', content: 'Jaka gra na steam sale? Budget 50zł' },

  // AMA
  { channel: 'ama', content: 'Czy streamerzy czytają ten czat? 👀' },
  { channel: 'ama', content: 'Ile zarabiacie na streamach? Pytam serio bo myślę o starcie' },

  // Jokes
  { channel: 'general', content: 'Twitch chat be like: KEKW KEKW KEKW ale tutaj jest normalna rozmowa haha' },
  { channel: 'general', content: 'Mój cat jumped on keyboard, to jest jego wiadomość: asdjfk' },
];

async function main() {
  console.log('🌱 Starting chat seed...\n');

  // ── 1. Create (or find) fake users ──
  // Losowe hasło, którego nikt nie zna — na te konta nie da się zalogować.
  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  const userIds: number[] = [];

  for (const u of FAKE_USERS) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        passwordHash,
        isActive: true,
      },
    });
    userIds.push(user.id);
    console.log(`  ✓ User ${user.username} (id ${user.id})`);
  }

  // ── 2. Build channel slug → id map ──
  const channels = await prisma.channel.findMany({
    where: { scope: 'GLOBAL', isActive: true },
    select: { id: true, slug: true },
  });
  const slugToId = new Map(channels.map((c) => [c.slug, c.id]));
  console.log(`  ✓ Loaded ${channels.length} channels\n`);

  // ── 3. Insert messages spread across users with staggered timestamps ──
  const now = Date.now();
  let inserted = 0;

  for (let i = 0; i < SEED_MESSAGES.length; i++) {
    const msg = SEED_MESSAGES[i];
    const channelId = slugToId.get(msg.channel);
    if (!channelId) {
      console.log(`  ⏭ Skipping — channel '${msg.channel}' not found`);
      continue;
    }

    // Round-robin user assignment
    const authorId = userIds[i % userIds.length];

    // Stagger messages over the last 48 hours so they look organic
    const offsetMs = ((SEED_MESSAGES.length - i) / SEED_MESSAGES.length) * 48 * 60 * 60 * 1000;
    // Add some jitter (±30 min)
    const jitter = (Math.random() - 0.5) * 60 * 60 * 1000;
    const createdAt = new Date(now - offsetMs + jitter);

    await prisma.message.create({
      data: {
        channelId,
        authorId,
        content: msg.content,
        createdAt,
      },
    });
    inserted++;
  }

  console.log(`✅ Inserted ${inserted} seed messages across ${slugToId.size} channels`);
  console.log('   Messages are spread over the last 48h with random jitter.\n');

  // ── 4. Summary ──
  for (const [slug, id] of slugToId) {
    const count = await prisma.message.count({ where: { channelId: id } });
    console.log(`  #${slug}: ${count} total messages`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
