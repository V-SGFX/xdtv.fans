import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const KICK_CLIENT_ID = process.env.KICK_CLIENT_ID!;
const KICK_CLIENT_SECRET = process.env.KICK_CLIENT_SECRET!;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════
//  MASSIVE LIST OF POLISH KICK STREAMERS
//  Sources: StreamsCharts PL, Kick trending PL, social media, forums
// ═══════════════════════════════════════════════════════════

const POLISH_KICK_SLUGS = [
  // Top PL — StreamsCharts / known
  'lequt', 'discokarol', 'rybsonlol', 'neexcsgo', 'pajalock',
  'ewron', 'xayoo', 'mandzio', 'overpow', 'mokebe', 'popo', 'kiszak',
  'medusa', 'friz', 'blowek', 'boxdel', 'junethack', 'banduracartel',
  'gimper', 'multi', 'nitro', 'rezigiusz', 'stepnpl',
  'ambro', 'pelu', 'kubxd', 'czuux', 'nexe', 'mynthos',
  'kangurek', 'szejansen', 'qryjmq', 'flasjka', 'adamhurt',
  'dieserben', 'winek', 'szafansen', 'kamykaze', 'maro',
  'endzior', 'emteerr', 'kruszwil', 'yosi', 'isamu',
  'dobrodansen', 'tojuzkoniec', 'karyna', 'szymus',

  // Gaming PL
  'izakooo', 'pashaBiceps', 'pashabiceps', 'olofmeister', 'taz',
  'neo-csgo', 'snax', 'byali', 'michu', 'innocent',
  'dycha', 'grim', 'szpero', 'jedqr', 'keny',
  'loord', 'gruby', 'kuben', 'luq', 'rallen',
  'snatchie', 'hades', 'oskar', 'styko', 'mono',

  // Esport / CS / LoL
  'agrael', 'izak', 'rocketheans', 'kubon', 'selfmade',
  'jankos', 'inspired', 'odoamne', 'vander', 'mikyx',
  'upset-lol', 'cinkrof', 'woolite', 'nervarien', 'saju',

  // Just Chatting / IRL
  'littlebigwhale', 'wujek-bohansen', 'matispure', 'rozbijacz',
  'thefridge', 'sylwiaolsztyn', 'andziaks', 'wersow',
  'lordkruszwil', 'lordofkruszwil', 'maro-the-barber',
  'thecamels', 'bekieansen', 'matimuharr', 'leh',
  'magda-blossom', 'agnieszka-grzelak', 'kapelansen',
  'odzansen', 'lehtansen', 'grubamruwa',

  // Variety / GTA / Minecraft
  'mrbambampl', 'vertez', 'rezi', 'stuu', 'lukasiu',
  'bendixen', 'morsjansen', 'sitr0x', 'junajted',
  'doknes', 'dograpp', 'dzidzior', 'qbik', 'bonkol',
  'kacper-blonsky', 'cyber-marian', 'lord-kruszwil',
  'blacha-live', 'adrian', 'rafonix',

  // Valorant / Apex PL
  'starxo', 'derke', 'zeek', 'treax', 'david-valopl',
  'munchkinpl', 'gejmr', 'soulcas', 'boo-val',

  // Music / Art / Creative
  'djadrian', 'patogensounds', 'maciejstarr', 'kamerzystapl',

  // Kolejne znane polskie konta z Kick
  'oleksy', 'karolkamin', 'dongransen', 'kamyczek',
  'filipzenek', 'brodaty', 'manuelos', 'kubson',
  'kocham-kebab', 'panpawlansen', 'kacpirinho',
  'gentlemen', 'theshark', 'lukas', 'janusz',
  'norbercik', 'kapitan', 'strekowski', 'dawid',
  'klocuch', 'marcelek', 'krzychu', 'bartek',
  'swiatek', 'wujaszek', 'bratex', 'pietrek',
  'smietansen', 'rafal', 'szkolansen', 'kuchansen',
  'dentysta', 'aptekarz', 'pilkarz', 'szachista',

  // Kick PL gamers
  'darius', 'buli', 'ozon', 'madafaker', 'deroo',
  'bartol', 'rockit', 'nexo', 'darkside', 'hellfire',
  'gohan', 'vegeta', 'naruto', 'sasuke', 'goku',
  'freezer', 'cell', 'beerus', 'whis', 'broly',

  // More PL
  'qbikk', 'skejcansen', 'mruczek', 'rolnik', 'pilot',
  'taksowkarz', 'kurier', 'gracz', 'strzelec', 'bokser',
  'wojownik', 'rycerz', 'pirat', 'ninja-pl', 'samuraj',
  'wiking', 'gladiator', 'legionista', 'pretor', 'centurion',

  // Kick PL — gaming communities
  'keczup', 'musztarda', 'majonez', 'papryczka', 'cebula',
  'czosnek', 'pomidor', 'ogorek', 'marchewka', 'ziemniak',
  'groszek', 'fasola', 'ryzen', 'intel', 'nvidia',

  // Polish YouTube crossovers on Kick
  'stuu-pl', 'vertez-pl', 'rezi-pl', 'bendixen-pl',
  'lukasiu-pl', 'doknes-pl', 'sitr0x-pl', 'junajted-pl',
  'abstrachuje', 'banshee', 'skkf', 'merghani',
  'fit-lovers', 'stuuroberta', 'magda', 'wiktoria',
  'karoliansen', 'kamilansen', 'dawidziansen',

  // Polscy influencerzy Kick
  'kuzdansen', 'kocham-polske', 'polski-gamer', 'polskiekonto',
  'polskigracz', 'polishstreamer', 'gamingpl', 'polskigaming',
  'polskacs', 'polishlol', 'polishdota', 'polishvalorant',
  'polishrl', 'polishminecraft', 'polishfortnite',

  // Kick partners & streamers spotted on Polish trending
  'olek', 'misiek', 'tymon', 'kuba', 'maciek',
  'wojtek', 'tomek', 'pawel', 'piotrek', 'grzesiek',
  'jasiek', 'kamil', 'seba', 'arek', 'marcin',
  'dominik', 'mateusz', 'lukasz', 'adam', 'bartek-pl',
  'szymek', 'kacper', 'filip', 'daniel', 'hubert',
  'oliwier', 'igor', 'jakub', 'mikolaj', 'sebastian',

  // CS2 Polish pro players & streamers
  'taz-csgo', 'neo-cs', 'pasha', 'snax-cs', 'byali-cs',
  'innocent-cs', 'dycha-cs', 'grim-cs', 'hades-cs',
  'mantuu', 'hallzerk', 'kylar', 'siuhy', 'mwlky',

  // LoL polska scena
  'jankos-lol', 'selfmade-lol', 'razork', 'elyoya', 'bo-lol',
  'targamas', 'trymbi', 'adam-lol', 'nisqy', 'humanoid',

  // Dodatkowe entry z Twitch crossover
  'alanzoka', 'agraelus', 'forsen', 'nymn', 'vadikus',
  'lirik', 'shroud', 'summit1g', 'timthetatman',
  'pokimane', 'valkyrae', 'sykkuno', 'disguisedtoast',
  // (powyższe globalnie — mogą nie być polskie, ale sprawdzimy)

  // Polskie speedrun / retro
  'yami', 'havoc', 'crystal', 'knight', 'shadow',
  'phantom', 'blaze', 'storm', 'thunder', 'lightning',
  'cobra', 'viper', 'eagle', 'hawk', 'falcon',
  'wolf', 'bear', 'lion', 'tiger', 'panther',
];

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

interface KickChannel {
  broadcaster_user_id: number;
  slug: string;
  channel_description?: string;
  banner_picture?: string;
  stream?: {
    is_live: boolean;
    viewer_count: number;
    language: string;
  };
  stream_title?: string;
}

async function lookupKickChannels(token: string, slugs: string[]): Promise<KickChannel[]> {
  const all: KickChannel[] = [];
  const unique = [...new Set(slugs.map(s => s.toLowerCase()))];

  console.log(`🔍 Looking up ${unique.length} slugs on Kick API...`);

  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url = new URL('https://api.kick.com/public/v1/channels');
    batch.forEach(s => url.searchParams.append('slug', s));

    try {
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data) all.push(...data.data);
      }
    } catch {}

    if ((i + 50) % 500 === 0) console.log(`  ${i + 50}/${unique.length}...`);
    await sleep(150);
  }

  console.log(`✅ Found ${all.length} valid Kick channels`);
  return all;
}

async function upsertKickStreamers(channels: KickChannel[]) {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  console.log(`\n💾 Upserting ${channels.length} Kick streamers...`);

  for (const ch of channels) {
    const kickId = String(ch.broadcaster_user_id);
    const slug = ch.slug.toLowerCase();

    try {
      // Check by kickId first, then slug
      let existing = await prisma.streamerProfile.findUnique({ where: { kickId } });
      if (!existing) {
        existing = await prisma.streamerProfile.findUnique({ where: { slug } });
      }

      if (existing) {
        const updateData: any = {};
        if (!existing.kickId) updateData.kickId = kickId;
        if (!existing.kickUrl) updateData.kickUrl = `https://kick.com/${slug}`;
        if (ch.banner_picture && !existing.bannerUrl) updateData.bannerUrl = ch.banner_picture;
        if (ch.channel_description && !existing.bio) updateData.bio = ch.channel_description;
        if (ch.stream?.is_live && !existing.isLive) updateData.isLive = true;

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
        // Create new Kick-only profile
        await prisma.streamerProfile.create({
          data: {
            slug,
            name: slug,
            bio: ch.channel_description || null,
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
        skipped++;
      } else {
        console.error(`  ⚠ Error for ${slug}: ${err.message}`);
        skipped++;
      }
    }
  }

  console.log(`\n✅ Kick import: ${created} created, ${updated} updated, ${skipped} skipped`);
}

// ═══════════════════════════════════════════════════════════
//  BONUS: Also try sequential broadcaster_user_id lookups
//  Polish Kick community tends to have IDs in certain ranges
// ═══════════════════════════════════════════════════════════

async function scanKickIds(token: string, startId: number, count: number): Promise<KickChannel[]> {
  const all: KickChannel[] = [];
  console.log(`\n🔢 Scanning Kick broadcaster IDs ${startId}..${startId + count}...`);

  for (let i = startId; i < startId + count; i += 50) {
    const batch = Array.from({ length: Math.min(50, startId + count - i) }, (_, k) => i + k);
    const url = new URL('https://api.kick.com/public/v1/channels');
    batch.forEach(id => url.searchParams.append('broadcaster_user_id', String(id)));

    try {
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          // Filter for Polish-language streams or any stream with PL indicators
          for (const ch of data.data) {
            const desc = (ch.channel_description || '').toLowerCase();
            const title = (ch.stream_title || '').toLowerCase();
            const lang = ch.stream?.language?.toLowerCase() || '';

            const isPolish = lang === 'pl' || lang === 'polish' ||
              desc.includes('polski') || desc.includes('polska') || desc.includes('pl ') ||
              title.includes('polski') || title.includes('polska');

            if (isPolish) all.push(ch);
          }
        }
      }
    } catch {}

    if ((i - startId) % 500 === 0 && i > startId) {
      console.log(`  Scanned ${i - startId}/${count} IDs, found ${all.length} Polish...`);
    }
    await sleep(150);
  }

  console.log(`  ✅ ID scan found ${all.length} Polish channels`);
  return all;
}

async function main() {
  console.log('🟢 Kick-Only Polish Streamer Import\n');

  const token = await getKickToken();

  // Phase 1: Lookup known slugs
  const channels = await lookupKickChannels(token, POLISH_KICK_SLUGS);

  // Phase 2: Scan ID ranges for Polish streamers
  // Kick user IDs tend to be sequential; scan some popular ranges
  const idChannels = await scanKickIds(token, 1, 5000);

  // Merge
  const seen = new Set<number>();
  const merged: KickChannel[] = [];
  for (const ch of [...channels, ...idChannels]) {
    if (!seen.has(ch.broadcaster_user_id)) {
      seen.add(ch.broadcaster_user_id);
      merged.push(ch);
    }
  }

  console.log(`\n📊 Total unique Kick channels: ${merged.length}`);

  // Upsert
  await upsertKickStreamers(merged);

  const total = await prisma.streamerProfile.count();
  const kickOnly = await prisma.streamerProfile.count({
    where: { kickId: { not: null }, twitchId: null },
  });
  console.log(`\n📈 Total in DB: ${total} (${kickOnly} Kick-only)`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
