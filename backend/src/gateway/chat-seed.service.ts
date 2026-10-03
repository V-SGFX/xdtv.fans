import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

/* ═══════════════════════════════════════════════════════════
   Chat Seed Service — pytanie dnia (9:00, 15:00, 21:00)

   Zostało jedno zadanie z trzech. Dwa pozostałe — powiadomienia
   o streamerach na czasie co 5 minut i „puls aktywności", gdy czat
   jest cichy co 20 minut — wycięte świadomie.

   Powód nie jest wydajnościowy. Te wiadomości nigdy nie trafiały do
   bazy, tylko szły przez socket do aktualnie podłączonych, więc przy
   pustym czacie leciały donikąd. A gdy czat wreszcie ożyje, „puls
   aktywności przy ciszy" jest udawaniem, że rozmowa trwa. Pytanie dnia
   zostaje, bo nie udaje niczego: daje temat i widać, że jest redakcyjne.
   ═══════════════════════════════════════════════════════════ */

/* ── Daily Questions — rotate per day, channel-aware ── */
const DAILY_QUESTIONS: Record<string, string[]> = {
  general: [
    '📊 Pytanie dnia: Który streamer zasługuje na więcej widzów?',
    '📊 Pytanie dnia: Co was najbardziej wkurza u streamerów?',
    '📊 Pytanie dnia: Najlepszy moment na streamie w tym tygodniu?',
    '📊 Pytanie dnia: Który streamer powinien zacząć robić IRL?',
    '📊 Pytanie dnia: Gdybyście mogli ukraść jeden emote z dowolnego kanału — jaki?',
    '📊 Pytanie dnia: Jaki stream leciał w tle, jak robiliście coś innego?',
    '📊 Pytanie dnia: Najlepsza rada jaką dał streamer na streamie?',
    '📊 Pytanie dnia: Kto ma najlepszy setup streamowy w PL?',
    '📊 Pytanie dnia: Gdybyś mógł odbanować jedną osobę na Twitchu — kogo?',
    '📊 Pytanie dnia: Hot take: subowanie to wyrzucanie pieniędzy? Tak/Nie i dlaczego',
    '📊 Pytanie dnia: Kto was dzisiaj zaskoczył na streamie?',
    '📊 Pytanie dnia: Jaki stream puszczacie komuś żeby go zainteresować polskim Twitchem?',
    '📊 Pytanie dnia: Najlepszy clip jaki widzieliście w tym miesiącu?',
    '📊 Pytanie dnia: Streamer którego nie lubiliście, ale zmieniliście zdanie?',
  ],
  drama: [
    '🔥 Drama dnia: Jaka drama była najbardziej przesadzona w historii?',
    '🔥 Drama dnia: Kto powinien wreszcie się pogodzić?',
    '🔥 Drama dnia: Jaki beef byście chcieli zobaczyć?',
    '🔥 Drama dnia: Najbardziej niesprawiedliwy ban na polskim Twitchu?',
    '🔥 Drama dnia: Kto najgorzej wyszedł z ostatniej dramy?',
    '🔥 Drama dnia: Jaki drama take się nie zestarzał?',
    '🔥 Drama dnia: Streamer który powinien odpuścić Twittera?',
  ],
  gaming: [
    '🎮 Pytanie dnia: W co gracie dzisiaj wieczorem?',
    '🎮 Pytanie dnia: Jaka gra jest najbardziej overhyped w 2026?',
    '🎮 Pytanie dnia: Najlepsza gra na którą nikt nie patrzył?',
    '🎮 Pytanie dnia: Jedna gra na pustą wyspę — jaka?',
    '🎮 Pytanie dnia: Jaki game miał najgorszy launch w historii?',
    '🎮 Pytanie dnia: Hot take: gry singleplayer > multiplayer. Tak czy nie?',
    '🎮 Pytanie dnia: Jaka gra z dzieciństwa trzyma się najlepiej?',
  ],
  ama: [
    '❓ Pytanie dnia: Gdybyś miał zadać jedno pytanie dowolnemu streamerowi — jakie?',
    '❓ Pytanie dnia: Co byście chcieli wiedzieć o kulisach streamowania?',
    '❓ Pytanie dnia: Jakie pytanie zawsze chcieliście zadać na AMA ale się baliście?',
  ],
};

/* ── Activity Pulse — casual messages when chat is dead ── */
/* ── Seed Messages — natural-looking starter messages ── */
export const SEED_MESSAGES: { channel: string; content: string }[] = [
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

@Injectable()
export class ChatSeedService implements OnModuleInit {
  private readonly logger = new Logger(ChatSeedService.name);
  private server: Server | null = null;
  // channelSlug -> channelId cache
  private channelIdCache = new Map<string, number>();

  constructor(private prisma: PrismaService) {}

  /** Called by ChatGateway to share the Socket.IO server instance */
  setServer(server: Server) {
    this.server = server;
  }

  async onModuleInit() {
    await this.loadChannelCache();
  }

  private async loadChannelCache() {
    const channels = await this.prisma.channel.findMany({
      where: { scope: 'GLOBAL', isActive: true },
      select: { id: true, slug: true },
    });
    for (const ch of channels) {
      this.channelIdCache.set(ch.slug, ch.id);
    }
    this.logger.log(`Loaded ${channels.length} global channels for seeding`);
  }

  private getChannelId(slug: string): number | undefined {
    return this.channelIdCache.get(slug);
  }

  private emitSystem(channelId: number, body: string, type = 'prompt') {
    if (!this.server) return;
    this.server.to(`channel:${channelId}`).emit('system_message', {
      type,
      body,
      createdAt: new Date().toISOString(),
    });
  }

  /* ══════════════════════════════════════════
     CRON: Daily Questions — 9:00, 15:00, 21:00
     ══════════════════════════════════════════ */
  @Cron('0 9,15,21 * * *')
  async postDailyQuestion() {
    const day = Math.floor(Date.now() / 86_400_000);
    const hour = new Date().getHours();
    // Different question per time slot (morning/afternoon/evening)
    const slotOffset = hour < 12 ? 0 : hour < 18 ? 1 : 2;

    for (const [slug, questions] of Object.entries(DAILY_QUESTIONS)) {
      const channelId = this.getChannelId(slug);
      if (!channelId) continue;

      const idx = (day * 3 + slotOffset) % questions.length;
      this.emitSystem(channelId, questions[idx], 'daily_question');
      this.logger.log(`Posted daily question in #${slug}`);
    }
  }

  /* ══════════════════════════════════════════
     CRON: Trending Streamer — every 5 min
     ══════════════════════════════════════════ */

  /* ══════════════════════════════════════════
     CRON: Activity Pulse — every 20 min
     Only fires if no real messages in 15 min
     ══════════════════════════════════════════ */
}
