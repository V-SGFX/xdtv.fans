import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID!;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!;
const KICK_CLIENT_ID = process.env.KICK_CLIENT_ID!;
const KICK_CLIENT_SECRET = process.env.KICK_CLIENT_SECRET!;

const TARGET = 30_000;
const PAGES_PER_QUERY = 10; // each page = 100 results
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════
//  TWITCH HELPERS
// ═══════════════════════════════════════════════════════════

let twitchToken = '';

async function getTwitchToken(): Promise<string> {
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
  if (!data.access_token) throw new Error(`Twitch token fail: ${JSON.stringify(data)}`);
  twitchToken = data.access_token;
  return twitchToken;
}

async function twitchGet(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${twitchToken}`,
    },
  });
  if (res.status === 401) {
    await getTwitchToken();
    return twitchGet(url);
  }
  if (res.status === 429) {
    const reset = Number(res.headers.get('Ratelimit-Reset') || 5);
    console.log(`  ⏳ Rate limit, waiting ${reset}s...`);
    await sleep(reset * 1000);
    return twitchGet(url);
  }
  if (!res.ok) return { data: [] };
  return res.json();
}

// ═══════════════════════════════════════════════════════════
//  SEARCH QUERIES — huge diverse list
// ═══════════════════════════════════════════════════════════

const SEARCH_QUERIES = [
  // Polish words & phrases
  'polski', 'polska', 'polskie', 'polsku', 'po polsku', 'streamer', 'stream',
  'gry', 'gaming', 'gracz', 'gramy', 'gram', 'rozrywka', 'zabawa', 'humor',
  'śmieszne', 'nocny', 'wieczorny', 'poranny', 'relax', 'chill', 'luz',
  'najlepszy', 'super', 'mega', 'epickie', 'legendarne', 'kozackie',
  'warszawa', 'kraków', 'wrocław', 'poznań', 'gdańsk', 'łódź', 'katowice',
  'lublin', 'szczecin', 'bydgoszcz', 'białystok', 'rzeszów', 'toruń',
  'kielce', 'olsztyn', 'opole', 'radom', 'częstochowa', 'sosnowiec',
  'gliwice', 'zabrze', 'bytom', 'ruda', 'tychy', 'dąbrowa', 'elbląg',
  'płock', 'wałbrzych', 'włocławek', 'tarnów', 'chorzów', 'koszalin',
  'kalisz', 'legnica', 'grudziądz', 'jaworzno', 'słupsk', 'jastrzębie',
  'nowy sącz', 'jelenia góra', 'siedlce', 'mysłowice', 'konin', 'piła',
  'ostrów', 'stargard', 'gniezno', 'inowrocław', 'ostrowiec', 'suwałki',
  'świdnica', 'pabianice', 'zamość', 'chełm', 'tomaszów', 'leszno',
  
  // Polish names (common)
  'kacper', 'jakub', 'filip', 'szymon', 'mateusz', 'adam', 'michał',
  'piotr', 'tomasz', 'łukasz', 'marcin', 'paweł', 'grzegorz', 'krzysztof',
  'wojciech', 'robert', 'daniel', 'dawid', 'sebastian', 'kamil',
  'bartosz', 'adrian', 'maciej', 'dominik', 'hubert', 'oliwier', 'igor',
  'mikołaj', 'wiktor', 'aleksander', 'jan', 'andrzej', 'marek', 'rafał',
  'artur', 'damian', 'norbert', 'patryk', 'przemysław', 'radosław',
  'karol', 'oskar', 'konrad', 'leszek', 'bogdan', 'tadeusz', 'kazimierz',
  'julia', 'zuzanna', 'maja', 'zofia', 'hanna', 'lena', 'alicja',
  'oliwia', 'amelia', 'wiktoria', 'natalia', 'aleksandra', 'maria',
  'anna', 'agnieszka', 'magdalena', 'katarzyna', 'monika', 'dorota',
  'ewa', 'barbara', 'joanna', 'beata', 'renata', 'iwona', 'marta',
  'sylwia', 'aneta', 'justyna', 'karolina', 'paulina', 'weronika',
  
  // Polish gamer tags patterns
  'pl', 'polska', 'polak', 'polish', 'pol', 'plpl', 'gracz pl',
  'streamerpl', 'gamingpl', 'plgaming', 'polskigaming', 'polishgaming',
  
  // Game names (massive)
  'counter-strike', 'cs2', 'csgo', 'cs go', 'valorant', 'league of legends',
  'lol', 'dota', 'dota 2', 'overwatch', 'overwatch 2', 'apex legends',
  'apex', 'fortnite', 'minecraft', 'gta', 'gta v', 'gta 5', 'gta 6',
  'gta online', 'fivem', 'red dead', 'rdr2', 'rust', 'ark', 'dayz',
  'escape from tarkov', 'tarkov', 'pubg', 'warzone', 'call of duty',
  'cod', 'battlefield', 'rainbow six', 'r6', 'siege', 'dead by daylight',
  'dbd', 'among us', 'phasmophobia', 'lethal company', 'the finals',
  'world of warcraft', 'wow', 'final fantasy', 'ffxiv', 'ff14',
  'lost ark', 'path of exile', 'poe', 'diablo', 'diablo 4', 'diablo iv',
  'hearthstone', 'teamfight tactics', 'tft', 'auto chess', 'chess',
  'rocket league', 'fifa', 'fc 25', 'fc 26', 'ea fc', 'pes', 'efootball',
  'nba 2k', 'madden', 'formula 1', 'f1', 'gran turismo', 'forza',
  'forza horizon', 'need for speed', 'nfs', 'assetto corsa', 'iracing',
  'euro truck', 'ets2', 'farming simulator', 'cities skylines',
  'civilization', 'civ', 'civ 6', 'age of empires', 'aoe', 'starcraft',
  'total war', 'crusader kings', 'hoi4', 'hearts of iron', 'europa universalis',
  'stellaris', 'factorio', 'satisfactory', 'rimworld', 'dwarf fortress',
  'kerbal', 'subnautica', 'no mans sky', 'valheim', 'terraria',
  'stardew valley', 'animal crossing', 'pokemon', 'zelda', 'mario',
  'super smash', 'tekken', 'street fighter', 'mortal kombat', 'mk1',
  'elden ring', 'dark souls', 'sekiro', 'bloodborne', 'armored core',
  'resident evil', 'silent hill', 'outlast', 'horror', 'survival',
  'the witcher', 'wiedźmin', 'cyberpunk', 'cyberpunk 2077', 'starfield',
  'baldurs gate', 'bg3', 'divinity', 'pillars of eternity', 'pathfinder',
  'skyrim', 'fallout', 'fallout 4', 'fallout 76', 'oblivion', 'morrowind',
  'assassins creed', 'far cry', 'watch dogs', 'ghost recon', 'the division',
  'destiny', 'destiny 2', 'halo', 'gears of war', 'god of war',
  'spider-man', 'batman', 'hogwarts legacy', 'harry potter',
  'roblox', 'roblox pl', 'garrys mod', 'gmod', 'scp', 'unturned',
  'sea of thieves', 'deep rock galactic', 'helldivers', 'helldivers 2',
  'palworld', 'enshrouded', 'sons of the forest', 'the forest',
  'raft', 'grounded', 'dont starve', 'project zomboid', '7 days to die',
  'left 4 dead', 'back 4 blood', 'world war z', 'killing floor',
  'hunt showdown', 'the cycle', 'vigor', 'scum', 'miscreated',
  'squad', 'arma', 'arma 3', 'arma reforger', 'hell let loose',
  'war thunder', 'world of tanks', 'wot', 'world of warships',
  'warthunder', 'il-2', 'dcs', 'flight simulator', 'msfs',
  'xplane', 'train sim', 'bus simulator', 'snowrunner', 'mudrunner',
  'geoguessr', 'tetris', 'osu', 'beat saber', 'vr', 'vr chat',
  'gorilla tag', 'blade and sorcery', 'pavlov', 'onward',
  'tabletop', 'poker', 'szachy', 'warcaby', 'planszówki',
  'slots', 'casino', 'ruletka', 'blackjack', 'kasyno',
  
  // Game categories
  'just chatting', 'irl', 'music', 'art', 'creative', 'asmr',
  'talk shows', 'food', 'cooking', 'fitness', 'sports', 'travel',
  'science', 'technology', 'software', 'programming', 'coding',
  'retro', 'retro gaming', 'speedrun', 'speedrunning', 'challenge',
  'unboxing', 'reaction', 'review', 'tutorial', 'poradnik', 'nauka',
  
  // Streamer culture
  'twitch', 'kick', 'youtube', 'tiktok', 'streamer', 'content creator',
  'esport', 'esports', 'pro player', 'professional', 'competitive',
  'ranked', 'rankedy', 'grind', 'tryhard', 'casual', 'noob', 'pro',
  'clutch', 'montage', 'highlights', 'funny', 'fails', 'win', 'lose',
  'rage', 'tilt', 'toxic', 'wholesome', 'pogchamp', 'pepega', 'monka',
  'copium', 'based', 'gigachad', 'sigma',
  
  // Popular Twitch categories 
  'special events', 'pools hot tubs', 'crypto', 'stocks', 'business',
  'education', 'science technology', 'makers crafting', 'beauty',
  'animals', 'outdoors', 'auto', 'tabletop rpg', 'dungeons dragons',
  'magic the gathering', 'mtg', 'yu-gi-oh', 'pokemon cards',
  
  // Letters and short patterns (catches diverse channels)
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah', 'ai', 'aj', 'ak', 'al', 'am', 'an', 'ao', 'ap',
  'ba', 'bb', 'bc', 'bd', 'be', 'bf', 'bg', 'bh', 'bi', 'bj', 'bk', 'bl', 'bm', 'bn', 'bo', 'bp',
  'ca', 'cb', 'cc', 'cd', 'ce', 'cf', 'cg', 'ch', 'ci', 'cj', 'ck', 'cl', 'cm', 'cn', 'co', 'cp',
  'da', 'db', 'dc', 'dd', 'de', 'df', 'dg', 'dh', 'di', 'dj', 'dk', 'dl', 'dm', 'dn', 'do', 'dp',
  'ea', 'eb', 'ec', 'ed', 'ee', 'ef', 'eg', 'eh', 'ei', 'ej', 'ek', 'el', 'em', 'en', 'eo', 'ep',
  'fa', 'fb', 'fc', 'fd', 'fe', 'ff', 'fg', 'fh', 'fi', 'fj', 'fk', 'fl', 'fm', 'fn', 'fo', 'fp',
  'ga', 'gb', 'gc', 'gd', 'ge', 'gf', 'gg', 'gh', 'gi', 'gj', 'gk', 'gl', 'gm', 'gn', 'go', 'gp',
  'ha', 'hb', 'hc', 'hd', 'he', 'hf', 'hg', 'hh', 'hi', 'hj', 'hk', 'hl', 'hm', 'hn', 'ho', 'hp',
  'ia', 'ib', 'ic', 'id', 'ie', 'if', 'ig', 'ih', 'ii', 'ij', 'ik', 'il', 'im', 'in', 'io', 'ip',
  'ja', 'jb', 'jc', 'jd', 'je', 'jf', 'jg', 'jh', 'ji', 'jj', 'jk', 'jl', 'jm', 'jn', 'jo', 'jp',
  'ka', 'kb', 'kc', 'kd', 'ke', 'kf', 'kg', 'kh', 'ki', 'kj', 'kk', 'kl', 'km', 'kn', 'ko', 'kp',
  'la', 'lb', 'lc', 'ld', 'le', 'lf', 'lg', 'lh', 'li', 'lj', 'lk', 'll', 'lm', 'ln', 'lo', 'lp',
  'ma', 'mb', 'mc', 'md', 'me', 'mf', 'mg', 'mh', 'mi', 'mj', 'mk', 'ml', 'mm', 'mn', 'mo', 'mp',
  'na', 'nb', 'nc', 'nd', 'ne', 'nf', 'ng', 'nh', 'ni', 'nj', 'nk', 'nl', 'nm', 'nn', 'no', 'np',
  'oa', 'ob', 'oc', 'od', 'oe', 'of', 'og', 'oh', 'oi', 'oj', 'ok', 'ol', 'om', 'on', 'oo', 'op',
  'pa', 'pb', 'pc', 'pd', 'pe', 'pf', 'pg', 'ph', 'pi', 'pj', 'pk', 'pl', 'pm', 'pn', 'po', 'pp',
  'ra', 'rb', 'rc', 'rd', 're', 'rf', 'rg', 'rh', 'ri', 'rj', 'rk', 'rl', 'rm', 'rn', 'ro', 'rp',
  'sa', 'sb', 'sc', 'sd', 'se', 'sf', 'sg', 'sh', 'si', 'sj', 'sk', 'sl', 'sm', 'sn', 'so', 'sp',
  'ta', 'tb', 'tc', 'td', 'te', 'tf', 'tg', 'th', 'ti', 'tj', 'tk', 'tl', 'tm', 'tn', 'to', 'tp',
  'wa', 'wb', 'wc', 'wd', 'we', 'wf', 'wg', 'wh', 'wi', 'wj', 'wk', 'wl', 'wm', 'wn', 'wo', 'wp',
  'za', 'zb', 'zc', 'zd', 'ze', 'zf', 'zg', 'zh', 'zi', 'zj', 'zk', 'zl', 'zm', 'zn', 'zo', 'zp',

  // Numbers
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '10', '11', '12', '13', '14', '15', '20', '21', '22', '23', '24', '25',
  '30', '33', '37', '42', '50', '69', '77', '88', '99', '100',
  '123', '200', '300', '420', '500', '666', '777', '1000', '1337', '2137',

  // More Polish words
  'dzień', 'noc', 'wieczór', 'rano', 'drużyna', 'team', 'clan', 'guild',
  'gildia', 'sojusz', 'liga', 'turniej', 'mecz', 'gra', 'bitwa', 'walka',
  'level', 'quest', 'mission', 'boss', 'raid', 'dungeon', 'pvp', 'pve',
  'mmorpg', 'rpg', 'fps', 'moba', 'battle royale', 'sandbox', 'survival',
  'horror game', 'indie', 'early access', 'beta', 'demo', 'free to play',
  'f2p', 'pay to win', 'p2w', 'skin', 'loot', 'drop', 'event', 'update',
  'patch', 'sezon', 'season', 'chapter', 'akt', 'episode', 'dlc', 'expansion',
];

interface RawStreamer {
  slug: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  twitchUrl?: string;
  twitchId?: string;
  followerCount: number;
  viewCount: number;
}

// ═══════════════════════════════════════════════════════════
//  PHASE 1: Live streams
// ═══════════════════════════════════════════════════════════

async function fetchLivePolish(seen: Set<string>, streamers: RawStreamer[]) {
  console.log('📺 Phase 1: LIVE Polish streams...');
  let cursor: string | undefined;

  while (true) {
    const url = new URL('https://api.twitch.tv/helix/streams');
    url.searchParams.set('language', 'pl');
    url.searchParams.set('first', '100');
    if (cursor) url.searchParams.set('after', cursor);

    const data = await twitchGet(url.toString());
    if (!data.data?.length) break;

    for (const s of data.data) {
      if (seen.has(s.user_id)) continue;
      seen.add(s.user_id);
      streamers.push({
        slug: s.user_login.toLowerCase(),
        name: s.user_name,
        twitchUrl: `https://twitch.tv/${s.user_login}`,
        twitchId: s.user_id,
        followerCount: 0,
        viewCount: s.viewer_count || 0,
      });
    }

    cursor = data.pagination?.cursor;
    if (!cursor) break;
    await sleep(50);
  }

  console.log(`  ✅ Live: ${streamers.length} streamers`);
}

// ═══════════════════════════════════════════════════════════
//  PHASE 2: Search — massive query bombardment
// ═══════════════════════════════════════════════════════════

async function searchPolish(seen: Set<string>, streamers: RawStreamer[]) {
  console.log(`\n📺 Phase 2: Search ${SEARCH_QUERIES.length} queries × ${PAGES_PER_QUERY} pages...`);

  let queryIdx = 0;
  let lastReport = Date.now();

  for (const query of SEARCH_QUERIES) {
    if (streamers.length >= TARGET) break;
    queryIdx++;

    let searchCursor: string | undefined;
    let foundInQuery = 0;

    for (let page = 0; page < PAGES_PER_QUERY; page++) {
      const url = new URL('https://api.twitch.tv/helix/search/channels');
      url.searchParams.set('query', query);
      url.searchParams.set('first', '100');
      url.searchParams.set('live_only', 'false');
      if (searchCursor) url.searchParams.set('after', searchCursor);

      const data = await twitchGet(url.toString());
      if (!data.data?.length) break;

      for (const ch of data.data) {
        if (ch.broadcaster_language !== 'pl') continue;
        if (seen.has(ch.id)) continue;
        seen.add(ch.id);
        foundInQuery++;

        streamers.push({
          slug: ch.broadcaster_login.toLowerCase(),
          name: ch.display_name,
          avatarUrl: ch.thumbnail_url || undefined,
          twitchUrl: `https://twitch.tv/${ch.broadcaster_login}`,
          twitchId: ch.id,
          followerCount: 0,
          viewCount: 0,
        });
      }

      searchCursor = data.pagination?.cursor;
      if (!searchCursor) break;
      await sleep(50);
    }

    // Progress report every 30s
    if (Date.now() - lastReport > 30_000) {
      console.log(`  [${queryIdx}/${SEARCH_QUERIES.length}] "${query}" +${foundInQuery} → total: ${streamers.length}`);
      lastReport = Date.now();
    }
  }

  console.log(`  ✅ Search done: ${streamers.length} total streamers`);
}

// ═══════════════════════════════════════════════════════════
//  PHASE 3: Fetch user profiles in batch (avatar, bio)
// ═══════════════════════════════════════════════════════════

async function enrichProfiles(streamers: RawStreamer[]) {
  console.log(`\n📸 Phase 3: Enriching ${streamers.length} profiles...`);

  const needEnrich = streamers.filter(s => s.twitchId && !s.avatarUrl);
  console.log(`  ${needEnrich.length} need profile fetch...`);

  for (let i = 0; i < needEnrich.length; i += 100) {
    const batch = needEnrich.slice(i, i + 100);
    const url = new URL('https://api.twitch.tv/helix/users');
    batch.forEach(s => url.searchParams.append('id', s.twitchId!));

    const data = await twitchGet(url.toString());
    if (data.data) {
      const map = new Map(data.data.map((u: any) => [u.id, u]));
      for (const s of batch) {
        const u = map.get(s.twitchId!) as any;
        if (u) {
          s.avatarUrl = u.profile_image_url;
          s.bannerUrl = u.offline_image_url;
          s.bio = u.description;
          s.name = u.display_name;
        }
      }
    }

    if (i % 5000 === 0 && i > 0) console.log(`  Enriched ${i}/${needEnrich.length}...`);
    await sleep(50);
  }

  console.log(`  ✅ Enrichment done`);
}

// ═══════════════════════════════════════════════════════════
//  PHASE 4: Kick cross-check
// ═══════════════════════════════════════════════════════════

async function crossCheckKick(streamers: RawStreamer[]) {
  console.log(`\n🟢 Phase 4: Kick cross-check for ${streamers.length} slugs...`);

  const res = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: KICK_CLIENT_ID,
      client_secret: KICK_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const tokenData = await res.json();
  if (!tokenData.access_token) {
    console.log('  ⚠ Kick token failed, skipping cross-check');
    return;
  }
  const kickToken = tokenData.access_token;

  // Only check first 5000 slugs to avoid excessive API calls
  const slugsToCheck = streamers.slice(0, 5000).map(s => s.slug);
  let kickFound = 0;

  for (let i = 0; i < slugsToCheck.length; i += 50) {
    const batch = slugsToCheck.slice(i, i + 50);
    const url = new URL('https://api.kick.com/public/v1/channels');
    batch.forEach(s => url.searchParams.append('slug', s));

    try {
      const r = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${kickToken}` },
      });
      if (r.ok) {
        const data = await r.json();
        if (data.data) {
          for (const ch of data.data) {
            const matched = streamers.find(s => s.slug === ch.slug);
            if (matched) {
              (matched as any).kickUrl = `https://kick.com/${ch.slug}`;
              (matched as any).kickId = String(ch.broadcaster_user_id);
              kickFound++;
            }
          }
        }
      }
    } catch {}

    if (i % 1000 === 0 && i > 0) console.log(`  Kick: ${i}/${slugsToCheck.length}, found ${kickFound}...`);
    await sleep(100);
  }

  console.log(`  ✅ Kick cross-matched: ${kickFound}`);
}

// ═══════════════════════════════════════════════════════════
//  PHASE 5: DB UPSERT (fast batch)
// ═══════════════════════════════════════════════════════════

async function upsertAll(streamers: RawStreamer[]) {
  let created = 0, updated = 0, skipped = 0;
  console.log(`\n💾 Phase 5: Upserting ${streamers.length} to DB...`);

  for (let i = 0; i < streamers.length; i++) {
    const s = streamers[i];
    try {
      let existing: any = null;
      if (s.twitchId) {
        existing = await prisma.streamerProfile.findUnique({ where: { twitchId: s.twitchId } });
      }
      if (!existing) {
        existing = await prisma.streamerProfile.findUnique({ where: { slug: s.slug } });
      }

      if (existing) {
        const up: any = {};
        if (s.twitchId && !existing.twitchId) up.twitchId = s.twitchId;
        if ((s as any).kickId && !existing.kickId) up.kickId = (s as any).kickId;
        if (s.twitchUrl && !existing.twitchUrl) up.twitchUrl = s.twitchUrl;
        if ((s as any).kickUrl && !existing.kickUrl) up.kickUrl = (s as any).kickUrl;
        if (s.avatarUrl && !existing.avatarUrl) up.avatarUrl = s.avatarUrl;
        if (s.bannerUrl && !existing.bannerUrl) up.bannerUrl = s.bannerUrl;
        if (s.bio && !existing.bio) up.bio = s.bio;
        if (s.viewCount > existing.viewCount) up.viewCount = s.viewCount;

        if (Object.keys(up).length > 0) {
          await prisma.streamerProfile.update({ where: { id: existing.id }, data: up });
          updated++;
        } else {
          skipped++;
        }
      } else {
        await prisma.streamerProfile.create({
          data: {
            slug: s.slug,
            name: s.name,
            bio: s.bio || null,
            avatarUrl: s.avatarUrl || null,
            bannerUrl: s.bannerUrl || null,
            twitchUrl: s.twitchUrl || null,
            kickUrl: (s as any).kickUrl || null,
            twitchId: s.twitchId || null,
            kickId: (s as any).kickId || null,
            followerCount: s.followerCount,
            viewCount: s.viewCount,
          },
        });
        created++;
      }
    } catch (err: any) {
      if (err.code === 'P2002') skipped++;
      else skipped++;
    }

    if ((i + 1) % 2000 === 0) {
      console.log(`  ${i + 1}/${streamers.length}: +${created} created, ~${updated} updated, =${skipped} skipped`);
    }
  }

  console.log(`\n✅ DB: ${created} created, ${updated} updated, ${skipped} skipped`);
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log(`🚀 MASSIVE IMPORT — Target: ${TARGET} Polish streamers`);
  console.log(`   Queries: ${SEARCH_QUERIES.length}, Pages/query: ${PAGES_PER_QUERY}\n`);

  await getTwitchToken();

  const seen = new Set<string>(); // Twitch user IDs
  const streamers: RawStreamer[] = [];

  // Phase 1
  await fetchLivePolish(seen, streamers);

  // Phase 2
  await searchPolish(seen, streamers);

  // Phase 3
  await enrichProfiles(streamers);

  // Phase 4
  await crossCheckKick(streamers);

  // Phase 5
  await upsertAll(streamers);

  const total = await prisma.streamerProfile.count();
  console.log(`\n📈 TOTAL IN DB: ${total}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
