import { Injectable } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import { readFile } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { NewsScraperService } from '../news/news-scraper.service';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import { PL_TRANSLATIONS } from './locale';
import { undernetResources } from './undernet-resources';
import { UndernetPrismaService } from './undernet-prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private adapterHost: HttpAdapterHost,
    private prisma: PrismaService,
    private config: ConfigService,
    private scraperService: NewsScraperService,
      private undernetDb: UndernetPrismaService,
  ) {}

  async onModuleInit() {
    /*
     * No HTTP server, no panel.
     *
     * An application context — the shape used by scripts, seeds and tests —
     * has no http adapter, so this threw before reaching a single line of
     * the caller's code. The whole app became unbootable outside `main.ts`,
     * which is exactly when you want to run a one-off task against real
     * services. Mounting an admin UI is not a precondition for the domain
     * to work, so its absence is skipped rather than fatal.
     */
    const httpAdapter = this.adapterHost?.httpAdapter;
    if (!httpAdapter) {
      console.log('[Admin] Brak serwera HTTP — pomijam montowanie panelu.');
      return;
    }
    const app = httpAdapter.getInstance();

    const importDynamic = new Function('modulePath', 'return import(modulePath)');
    const AdminJS = (await importDynamic('adminjs')).default;
    const AdminJSExpress = (await importDynamic('@adminjs/express')).default;
    const { Database, Resource, getModelByName } = await importDynamic('@adminjs/prisma');
    const { ComponentLoader } = await importDynamic('adminjs');

    AdminJS.registerAdapter({ Database, Resource });

    const componentLoader = new ComponentLoader();
    const dashboardComponent = componentLoader.add('Dashboard', path.resolve(process.cwd(), 'src/admin/components/dashboard'));
    /*
     * Drugi pulpit — dla UNDERNET.ONE.
     *
     * AdminJS ma dokładnie jeden `dashboard`, więc undernet dostaje własną
     * STRONĘ (`pages`), dostępną pod /admin/pages/undernet. Wpychanie obu
     * serwisów w jeden widok oznaczałoby albo połowę pól pustych, albo
     * liczby z dwóch baz w jednej tabeli.
     */
    const undernetDashboardComponent = componentLoader.add(
      'UndernetDashboard',
      path.resolve(process.cwd(), 'src/admin/components/undernet-dashboard'),
    );

    /* Miniatura na liście mediów i duży podgląd z listą użyć na karcie. */
    const mediaThumbComponent = componentLoader.add(
      'MediaThumb',
      path.resolve(process.cwd(), 'src/admin/components/media-thumb'),
    );
    const mediaPreviewComponent = componentLoader.add(
      'MediaPreview',
      path.resolve(process.cwd(), 'src/admin/components/media-preview'),
    );

    /*
     * Zasoby drugiego serwisu.
     *
     * Adapter @adminjs/prisma przyjmuje moduł klienta jako drugi argument
     * `getModelByName`, więc jeden panel obsługuje dwa schematy i dwie bazy.
     * Gdy klienta nie ma — bo undernet nie jest skonfigurowany — sekcja po
     * prostu nie powstaje, a panel xdtv działa jak dotąd.
     */
    const undernet = this.undernetDb.isAvailable
      ? undernetResources(getModelByName, this.undernetDb.client, this.undernetDb.module, {
          mediaThumb: mediaThumbComponent,
          mediaPreview: mediaPreviewComponent,
          publicUrl: this.config.get('UNDERNET_PUBLIC_URL', 'https://undernet.one'),
        })
      : [];

    const admin = new AdminJS({
      resources: [
        // ── Users ──
        {
          resource: { model: getModelByName('User'), client: this.prisma },
          options: {
            properties: {
              role: { description: 'USER — zwykłe konto. STREAMER — właściciel przejętego profilu. MODERATOR — moderuje cały serwis. ADMIN — pełny dostęp, w tym do tego panelu.' },
              isActive: { description: 'Wyłączenie blokuje logowanie. Treści użytkownika zostają.' },
              displayName: { description: 'Nazwa pokazywana zamiast loginu. Puste pole = używana jest nazwa użytkownika.' },
            },
            navigation: { name: 'Users', icon: 'User' },
            listProperties: ['id', 'username', 'email', 'role', 'isActive', 'createdAt'],
            filterProperties: ['username', 'email', 'role', 'isActive'],
            editProperties: ['username', 'email', 'displayName', 'role', 'isActive'],
          },
        },
        {
          resource: { model: getModelByName('Follow'), client: this.prisma },
          options: {
            navigation: { name: 'Users', icon: 'User' },
            listProperties: ['id', 'user', 'streamerProfile', 'createdAt'],
          },
        },
        {
          resource: { model: getModelByName('Report'), client: this.prisma },
          options: {
            properties: {
              status: { description: 'PENDING — czeka. RESOLVED — uznane. REJECTED — odrzucone jako bezzasadne.' },
              adminNote: { description: 'Uzasadnienie decyzji. Widoczne tylko w panelu.' },
            },
            navigation: { name: 'Users', icon: 'User' },
            listProperties: ['id', 'targetType', 'reason', 'reporter', 'status', 'createdAt'],
            filterProperties: ['targetType', 'status'],
          },
        },

        // ── Content ──
        {
          resource: { model: getModelByName('StreamerProfile'), client: this.prisma },
          options: {
            navigation: { name: 'Content', icon: 'Video' },
            listProperties: ['id', 'name', 'slug', 'isClaimed', 'isVerified', 'isLive', 'followerCount'],
            editProperties: ['name', 'slug', 'bio', 'avatarUrl', 'bannerUrl', 'twitchUrl', 'youtubeUrl', 'kickUrl', 'isClaimed', 'isVerified'],
          },
        },
        {
          /*
           * Bloki reklamowe.
           *
           * Klucz jest tylko do odczytu: to kontrakt z kodem strony,
           * a zmiana literki daje blok, którego nic nie wyrenderuje —
           * bez błędu, bez śladu, po prostu puste miejsce. Nowe bloki
           * zakłada się razem z komponentem w kodzie, nie z panelu.
           */
          resource: { model: getModelByName('AdSlot'), client: this.prisma },
          options: {
            navigation: { name: 'Monetyzacja', icon: 'DollarSign' },
            listProperties: ['position', 'key', 'name', 'isActive', 'updatedAt'],
            editProperties: ['name', 'description', 'code', 'isActive', 'position'],
            showProperties: ['key', 'name', 'description', 'code', 'isActive', 'position', 'updatedAt'],
            filterProperties: ['isActive'],
            actions: {
              new: { isAccessible: false },
              delete: { isAccessible: false },
              bulkDelete: { isAccessible: false },
            },
            properties: {
              key: {
                isDisabled: true,
                description: 'Kontrakt z kodem strony. Zmiana tego pola dałaby blok, którego nic nie wyrenderuje — dlatego jest zablokowane.',
              },
              code: {
                type: 'textarea',
                props: { rows: 12 },
                description: 'Cały kod od dostawcy reklam, ze znacznikiem <script> włącznie. Wklej to, co dostałeś z AdSense — nic nie trzeba przerabiać.',
              },
              description: {
                type: 'textarea',
                props: { rows: 3 },
                description: 'Notatka dla Ciebie: gdzie ten blok się pokazuje. Nie widzi jej nikt poza panelem.',
              },
              isActive: {
                description: 'Dopiero włączenie pokazuje blok na stronie. Wyłączony nie zostawia po sobie pustego miejsca w układzie.',
              },
              position: {
                description: 'Kolejność na tej liście. Nie wpływa na wygląd strony.',
              },
            },
          },
        },
        {
          // Registered because Follow.tagId points here. AdminJS resolves every
          // reference property when it builds a list, and a reference to an
          // unregistered resource throws rather than degrading — which is why
          // the Follow list answered 500 with "There are no resources with
          // given id: Tag" instead of simply omitting the column.
          resource: { model: getModelByName('Tag'), client: this.prisma },
          options: {
            properties: {
              slug: { description: 'Fragment adresu: /discover?game=TO-POLE. Małe litery i myślniki.' },
              type: { description: 'GAME dla gier, LANGUAGE dla języków, CATEGORY, FORMAT lub TOPIC dla reszty. Zakładka Gry w Odkrywaj pokazuje wyłącznie typ GAME.' },
              color: { description: 'Kolor plakietki szesnastkowo, np. #36d9e8.' },
            },
            navigation: { name: 'Content', icon: 'Tag' },
            listProperties: ['id', 'name', 'slug', 'type'],
            filterProperties: ['type'],
          },
        },
        {
          resource: { model: getModelByName('Post'), client: this.prisma },
          options: {
            properties: {
              isPinned: { description: 'Przypięty trafia na górę SWOJEJ społeczności, przy każdym sortowaniu. Poza nią nie ma znaczenia.' },
              isNsfw: { description: 'Zasłania miniaturę i ukrywa post przed niezalogowanymi.' },
              isDeleted: { description: 'Miękkie usunięcie — post znika z serwisu, ale zostaje w bazie.' },
            },
            navigation: { name: 'Content', icon: 'Document' },
            listProperties: ['id', 'title', 'type', 'author', 'upvotes', 'isDeleted', 'createdAt'],
            filterProperties: ['type', 'isDeleted', 'author'],
          },
        },
        {
          resource: { model: getModelByName('Community'), client: this.prisma },
          options: {
            properties: {
              slug: { description: 'Fragment adresu: /community?community=TO-POLE. Małe litery i myślniki, bez spacji i polskich znaków.' },
              color: { description: 'Kolor akcentu szesnastkowo, np. #ff2e88. Używany na kafelku społeczności.' },
              iconUrl: { description: 'Pełny adres obrazka ikony. Kwadrat, najlepiej 256x256.' },
              bannerUrl: { description: 'Pełny adres obrazka nagłówka. Poziomy, najlepiej 1200x300.' },
              rules: { description: 'Regulamin społeczności. Widoczny na jej stronie.' },
              isOfficial: { description: 'Oficjalna wyróżnia się na liście i jest proponowana nowym użytkownikom.' },
            },
            navigation: { name: 'Content', icon: 'Document' },
            listProperties: ['id', 'name', 'slug', 'isOfficial', 'postCount', 'memberCount', 'createdAt'],
          },
        },
        {
          resource: { model: getModelByName('News'), client: this.prisma },
          options: {
            properties: {
              title: { description: 'Tytuł po polsku — wersja domyślna, pokazywana przy polskim interfejsie.' },
              summary: { description: 'Zajawka po polsku, dwa-trzy zdania pod tytułem.' },
              titleEn: { description: 'Tytuł po angielsku. Puste pole oznacza, że przy angielskim interfejsie pokaże się polski.' },
              content: { description: 'Treść po polsku. Renderowana jako tekst — znaczniki HTML pokażą się jako litery.' },
              contentEn: { description: 'Treść po angielsku.' },
              sourceUrl: { description: 'Adres oryginału. Musi być unikalny — po nim rozpoznajemy, że artykuł już mamy.' },
              isPublished: { description: 'Wyłączenie ukrywa artykuł w serwisie bez usuwania go.' },
            },
            navigation: { name: 'Content', icon: 'Document' },
            listProperties: ['id', 'title', 'source', 'sourceName', 'isPublished', 'publishedAt'],
          },
        },
        {
          resource: { model: getModelByName('RssSource'), client: this.prisma },
          options: {
            properties: {
              url: { description: 'Pełny adres kanału RSS, np. https://www.dexerto.com/feed/. Musi zwracać XML, nie stronę HTML.' },
              language: { description: 'Język ORYGINAŁU: en albo pl. Decyduje, w którą stronę idzie tłumaczenie — kanał angielski tłumaczymy na polski, polski na angielski.' },
              category: { description: 'Do której zakładki w Newsach trafiają artykuły z tego kanału.' },
              isActive: { description: 'Wyłączenie zatrzymuje pobieranie. Artykuły już pobrane zostają.' },
            },
            navigation: { name: 'News Scraper', icon: 'Rss' },
            listProperties: ['id', 'name', 'url', 'language', 'isActive', 'articlesCount', 'lastScrapedAt'],
            editProperties: ['name', 'url', 'language', 'isActive'],
            filterProperties: ['isActive', 'language'],
          },
        },

        // ── Chat ──
        {
          resource: { model: getModelByName('Channel'), client: this.prisma },
          options: {
            properties: {
              scope: { description: 'GLOBAL — kanał ogólny, widoczny dla wszystkich. STREAMER — przypisany do jednego profilu streamera.' },
              slug: { description: 'Identyfikator kanału w adresie i w kodzie. Małe litery i myślniki.' },
              sortOrder: { description: 'Kolejność na liście kanałów. Mniejsza liczba wyżej.' },
              isActive: { description: 'Wyłączony kanał znika z czatu, ale wiadomości zostają w bazie.' },
            },
            navigation: { name: 'Chat', icon: 'Chat' },
            listProperties: ['id', 'scope', 'name', 'slug', 'type', 'streamerProfile', 'sortOrder', 'isActive', 'createdAt'],
            filterProperties: ['scope', 'type', 'isActive', 'streamerProfile'],
          },
        },
        {
          resource: { model: getModelByName('Message'), client: this.prisma },
          options: {
            navigation: { name: 'Chat', icon: 'Chat' },
            listProperties: ['id', 'content', 'author', 'channel', 'isDeleted', 'createdAt'],
            filterProperties: ['channel', 'isDeleted'],
          },
        },
        {
          resource: { model: getModelByName('ChannelMute'), client: this.prisma },
          options: {
            navigation: { name: 'Chat', icon: 'Chat' },
            listProperties: ['id', 'user', 'channel', 'expiresAt', 'createdAt'],
          },
        },
        {
          resource: { model: getModelByName('ChannelBan'), client: this.prisma },
          options: {
            navigation: { name: 'Chat', icon: 'Chat' },
            listProperties: ['id', 'user', 'channel', 'reason', 'createdAt'],
          },
        },
        {
          resource: { model: getModelByName('ChatEmoji'), client: this.prisma },
          options: {
            properties: {
              code: { description: 'To, co użytkownik wpisuje w czacie, np. :kekw:. Musi być unikalne.' },
              url: { description: 'Pełny adres obrazka. Najlepiej 112x112, PNG lub GIF.' },
              isGlobal: { description: 'Dostępna na wszystkich kanałach. Wyłączona — tylko na kanale wskazanego streamera.' },
              isPremium: { description: 'Tylko dla użytkowników z subskrypcją.' },
            },
            navigation: { name: 'Chat', icon: 'Chat' },
            // Kolumna nazywa się `url`, nie `imageUrl` — AdminJS zgłaszał to
            // ostrzeżeniem przy każdym wczytaniu panelu, a kolumny nie było widać.
            listProperties: ['id', 'name', 'code', 'url', 'isGlobal', 'createdAt'],
          },
        },

        // ── Hot Takes ──

        // ── Predictions ──

        // ── Rankings ──

        // ── Battles ──

        {
          // Dziennik działań administracyjnych. Zostaje mimo usunięcia
          // synchronizacji Steama: zapisują się tu nominacje i zatwierdzenia
          // moderatorów społeczności oraz ich działania.
          resource: { model: getModelByName('AdminActionLog'), client: this.prisma },
          options: {
            navigation: { name: 'Moderacja i audyt', icon: 'History' },
            listProperties: ['id', 'user', 'action', 'targetType', 'targetId', 'createdAt'],
            filterProperties: ['action', 'targetType', 'user'],
            /*
             * Tylko do odczytu — bez wyjątku, także dla administratora.
             *
             * Panel wystawiał tu formularz „Dodaj". Dziennik, do którego
             * da się ręcznie dopisać wpis albo skasować niewygodny, nie
             * odpowiada na jedyne pytanie, po co istnieje: kto to zrobił.
             * Wpisy powstają wyłącznie w kodzie, przy okazji operacji,
             * której dotyczą.
             */
            actions: {
              new: { isAccessible: false },
              edit: { isAccessible: false },
              delete: { isAccessible: false },
              bulkDelete: { isAccessible: false },
            },
          },
        },
        ...undernet,
      ],
      locale: {
        language: 'pl',
        availableLanguages: ['pl'],
        translations: { pl: PL_TRANSLATIONS as never },
      },
      rootPath: '/admin',
      branding: { companyName: 'XDTV Admin', logo: false },
      dashboard: { component: dashboardComponent },
      pages: this.undernetDb.isAvailable
        ? { undernet: { component: undernetDashboardComponent, icon: 'Book' } }
        : {},
      componentLoader,
    });

    const prisma = this.prisma;
    const cookieSecret = this.config.get('ADMIN_COOKIE_SECRET', 'change-me');
    const sessionSecret = this.config.get('SESSION_SECRET', 'change-me');

    /*
     * Session store.
     *
     * Left at the express-session default, sessions live in the memory of
     * this process, and the library warns about it on every boot. Two things
     * follow on a live server: memory grows without bound because nothing
     * evicts expired sessions, and every backend restart silently logs every
     * admin out — which reads as "the panel broke" rather than "the process
     * restarted".
     *
     * Redis already runs here for cache and queues, so the store costs one
     * connection. Sessions get their own key prefix, so they are easy to
     * inspect and to drop.
     */
    // connect-redis 9 rozmawia składnią node-redis:
    //   client.set(key, val, { expiration: { type: 'EX', value: ttl } })
    // ioredis oczekuje `set(key, val, 'EX', ttl)` i na tym obiekcie
    // odpowiada „ERR syntax error", co przewracało CAŁE logowanie do panelu
    // błędem 500 — sesja nie dawała się zapisać. Dlatego tu, i tylko tu,
    // używamy node-redis; reszta aplikacji zostaje na ioredis.
    const sessionRedis = createClient({
      socket: {
        host: this.config.get('REDIS_HOST', '127.0.0.1'),
        port: Number(this.config.get('REDIS_PORT', 6379)),
      },
    });
    sessionRedis.on('error', (err: Error) =>
      console.error('[Admin] Redis sesji:', err.message),
    );
    await sessionRedis.connect();
    const sessionStore = new RedisStore({
      client: sessionRedis,
      prefix: 'xdtv:admin-session:',
      ttl: 24 * 60 * 60,
    });

    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
      admin,
      {
        authenticate: async (email: string, password: string) => {
          const user = await prisma.user.findFirst({
            where: { email, role: 'ADMIN', isActive: true },
          });
          if (user && user.passwordHash && await bcrypt.compare(password, user.passwordHash)) {
            return { email: user.email, id: user.id, role: user.role };
          }
          return null;
        },
        cookieName: 'xdtv-admin',
        cookiePassword: cookieSecret,
      },
      null,
      {
        store: sessionStore,
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
      },
    );

    app.get('/admin/frontend/assets/components.bundle.js', async (_req: any, res: any) => {
      try {
        const bundlePath = path.resolve('.adminjs', 'bundle.js');
        const content = await readFile(bundlePath, 'utf-8');
        res.set('Content-Type', 'text/javascript;charset=utf-8');
        /*
         * Bez cache.
         *
         * Ta paczka to interfejs panelu, a dane do niego dostarcza API
         * z tego samego procesu. Domyślne `max-age=14400` trzymało ją
         * w przeglądarce cztery godziny, więc po wdrożeniu zmieniającym
         * kształt odpowiedzi admin dostawał nowe API i STARY interfejs —
         * i biały ekran z „Cannot read properties of undefined". Panel jest
         * dla kilku osób, więc pobranie kilkudziesięciu kilobajtów przy
         * każdym wejściu kosztuje mniej niż jedna taka pomyłka.
         */
        res.set('Cache-Control', 'no-store, must-revalidate');
        res.send(content);
      } catch {
        res.set('Content-Type', 'text/javascript;charset=utf-8');
        res.send('(function(){"use strict";AdminJS.UserComponents={}})();');
      }
    });

    /*
     * Statystyki UNDERNET.ONE — osobny adres, osobna baza.
     *
     * Pulpit xdtv liczy klipy, streamerów i kanały czatu; undernet nie ma
     * żadnej z tych rzeczy, a ma obieg redakcyjny, którego nie ma xdtv.
     * Wspólny pulpit musiałby albo pokazywać połowę pól pustych, albo
     * mieszać liczby z dwóch serwisów w jednej tabeli — i jedno, i drugie
     * jest gorsze niż dwa osobne widoki.
     */
    /*
     * Gdzie używany jest dany plik z biblioteki undernetu.
     *
     * Na routerze panelu, bo tu działa sesja administratora — bezpośrednie
     * wołanie API undernetu wymagałoby tokenu użytkownika tamtego serwisu.
     */
    adminRouter.get('/api/undernet-media/:id/uzycia', async (req: any, res: any) => {
      if (!this.undernetDb.isAvailable) return res.status(503).json({ uzycia: [] });
      const db = this.undernetDb.client;
      try {
        const asset = await db.mediaAsset.findUnique({ where: { id: Number(req.params.id) } });
        if (!asset) return res.json({ uzycia: [] });

        const [okladki, wTresci, wWpisach] = await Promise.all([
          db.contentItem.findMany({ where: { coverUrl: asset.url }, select: { id: true, title: true }, take: 5 }),
          db.contentItem.findMany({ where: { body: { contains: asset.url } }, select: { id: true, title: true }, take: 5 }),
          db.post.count({ where: { content: { contains: asset.url } } }),
        ]);

        const uzycia: string[] = [];
        for (const c of okladki) uzycia.push(`okładka #${c.id} „${String(c.title).slice(0, 45)}"`);
        for (const c of wTresci) uzycia.push(`treść #${c.id} „${String(c.title).slice(0, 45)}"`);
        if (wWpisach > 0) uzycia.push(`${wWpisach} wpis(ów) forum`);
        return res.json({ uzycia });
      } catch {
        return res.json({ uzycia: [] });
      }
    });

    adminRouter.get('/api/undernet-stats', async (_req: any, res: any) => {
      if (!this.undernetDb.isAvailable) {
        return res.status(503).json({ error: 'Baza UNDERNET.ONE jest niedostępna.' });
      }
      const db = this.undernetDb.client;

      try {
        const now = new Date();
        const dzisiaj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tydzien = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const miesiac = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [
          uzytkownicy, uzytkownicyDzis, uzytkownicyTydzien,
          rolaAutor, rolaRedaktor, rolaModerator,
          proAktywne, proBezterminowe, proWygasle, proTydzien, funkcjePlatne, funkcjeWszystkie,
          wpisy, wpisyDzis, wpisyTydzien,
          komentarze, komentarzeDzis,
          spolecznosci,
          materialy, szkice, wAkceptacji, opublikowane, opublikowaneDzis, zarchiwizowane,
          news, artykuly, howto, wiki,
          zWatkow, autorzy, kategorie, media,
        ] = await Promise.all([
          db.user.count(),
          db.user.count({ where: { createdAt: { gte: dzisiaj } } }),
          db.user.count({ where: { createdAt: { gte: tydzien } } }),
          db.user.count({ where: { role: 'AUTHOR' } }),
          db.user.count({ where: { role: 'EDITOR' } }),
          db.user.count({ where: { role: 'MODERATOR' } }),

          /*
           * UNDERNET PRO.
           *
           * „Aktywne" to konta z `isPro` i albo bez daty końca (dostęp
           * nadany ręcznie), albo z datą w przyszłości. Liczenie samego
           * `isPro` mieszałoby w to abonamenty, które już wygasły —
           * a to zupełnie inna liczba, przydatna osobno.
           */
          db.user.count({
            where: { isPro: true, OR: [{ proUntil: null }, { proUntil: { gt: now } }] },
          }),
          db.user.count({ where: { isPro: true, proUntil: null } }),
          db.user.count({ where: { isPro: true, proUntil: { lte: now } } }),
          db.user.count({
            where: { isPro: true, proUntil: { gt: now }, updatedAt: { gte: tydzien } },
          }),
          db.premiumFeature.count({ where: { requiresPremium: true } }),
          db.premiumFeature.count(),
          db.post.count({ where: { isDeleted: false } }),
          db.post.count({ where: { isDeleted: false, createdAt: { gte: dzisiaj } } }),
          db.post.count({ where: { isDeleted: false, createdAt: { gte: tydzien } } }),
          db.comment.count({ where: { isDeleted: false } }),
          db.comment.count({ where: { isDeleted: false, createdAt: { gte: dzisiaj } } }),
          db.community.count(),
          db.contentItem.count(),
          db.contentItem.count({ where: { status: 'DRAFT' } }),
          db.contentItem.count({ where: { status: 'REVIEW' } }),
          db.contentItem.count({ where: { status: 'PUBLISHED' } }),
          db.contentItem.count({ where: { status: 'PUBLISHED', publishedAt: { gte: dzisiaj } } }),
          db.contentItem.count({ where: { status: 'ARCHIVED' } }),
          db.contentItem.count({ where: { type: 'NEWS' } }),
          db.contentItem.count({ where: { type: 'ARTICLE' } }),
          db.contentItem.count({ where: { type: 'HOWTO' } }),
          db.contentItem.count({ where: { type: 'WIKI' } }),
          // Sedno idei portalu: ile materiałów wyrosło z dyskusji.
          db.contentItem.count({ where: { NOT: { sourcePostId: null } } }),
          db.author.count(),
          db.contentCategory.count(),
          db.mediaAsset.count(),
        ]);

        // Ostatnie decyzje redakcyjne — kto co przepuścił i kiedy.
        const decyzje = await db.editorialReview.findMany({
          take: 8,
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: { select: { username: true } },
            contentItem: { select: { title: true, type: true } },
          },
        });

        // Wykres: materiały opublikowane w ostatnich 14 dniach.
        const dni: { date: string; count: number }[] = [];
        for (let i = 13; i >= 0; i -= 1) {
          const od = new Date(dzisiaj.getTime() - i * 24 * 60 * 60 * 1000);
          const do_ = new Date(od.getTime() + 24 * 60 * 60 * 1000);
          dni.push({
            date: od.toISOString().slice(5, 10),
            count: await db.contentItem.count({
              where: { status: 'PUBLISHED', publishedAt: { gte: od, lt: do_ } },
            }),
          });
        }

        return res.json({
          uzytkownicy: {
            total: uzytkownicy, dzis: uzytkownicyDzis, tydzien: uzytkownicyTydzien,
            autor: rolaAutor, redaktor: rolaRedaktor, moderator: rolaModerator,
          },
          pro: {
            aktywne: proAktywne,
            bezterminowe: proBezterminowe,
            wygasle: proWygasle,
            tydzien: proTydzien,
            funkcjePlatne: funkcjePlatne,
            funkcjeWszystkie: funkcjeWszystkie,
            // Udział kont z PRO wśród wszystkich — jedna liczba mówiąca,
            // czy abonament w ogóle się przyjmuje.
            udzial: uzytkownicy > 0 ? Math.round((proAktywne / uzytkownicy) * 1000) / 10 : 0,
          },
          forum: {
            wpisy, wpisyDzis, wpisyTydzien, komentarze, komentarzeDzis, spolecznosci,
          },
          wiedza: {
            materialy, szkice, wAkceptacji, opublikowane, opublikowaneDzis, zarchiwizowane,
            news, artykuly, howto, wiki, zWatkow, autorzy, kategorie, media,
          },
          decyzje: decyzje.map((d: any) => ({
            kto: d.reviewer?.username ?? '—',
            tytul: d.contentItem?.title ?? '(usunięty)',
            typ: d.contentItem?.type ?? '',
            z: d.fromStatus,
            na: d.toStatus,
            kiedy: d.createdAt,
            uwaga: d.note,
          })),
          dziennie: dni,
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message ?? 'Nie udało się policzyć statystyk.' });
      }
    });

    // ── Stats API for dashboard (mounted under admin router for session) ──
    adminRouter.get('/api/stats', async (req: any, res: any) => {
      try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const [
          usersTotal, usersToday, usersWeek, usersMonth,
          postsTotal, postsToday, postsWeek, postsClips, postsText,
          msgsTotal, msgsToday, msgsWeek,
          streamersTotal, streamersClaimed, streamersLive,
          channelsGlobal, channelsStreamer,
          followsTotal,
          communitiesTotal,
          newsTotal, newsPublished,
          commentsTotal, commentsToday, commentsWeek,
          reportsPending, moderatorsPending,
        ] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
          prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
          prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
          prisma.post.count(),
          prisma.post.count({ where: { createdAt: { gte: todayStart } } }),
          prisma.post.count({ where: { createdAt: { gte: weekAgo } } }),
          prisma.post.count({ where: { type: 'CLIP' } }),
          prisma.post.count({ where: { type: 'TEXT' } }),
          prisma.message.count(),
          prisma.message.count({ where: { createdAt: { gte: todayStart } } }),
          prisma.message.count({ where: { createdAt: { gte: weekAgo } } }),
          prisma.streamerProfile.count(),
          prisma.streamerProfile.count({ where: { isClaimed: true } }),
          prisma.streamerProfile.count({ where: { isLive: true } }),
          prisma.channel.count({ where: { scope: 'GLOBAL', isActive: true } }),
          prisma.channel.count({ where: { scope: 'STREAMER', isActive: true } }),
          prisma.follow.count(),
          prisma.community.count(),
          prisma.news.count(),
          prisma.news.count({ where: { isPublished: true } }),
          prisma.comment.count(),
          prisma.comment.count({ where: { createdAt: { gte: todayStart } } }),
          prisma.comment.count({ where: { createdAt: { gte: weekAgo } } }),
          prisma.report.count({ where: { status: 'PENDING' } }),
          prisma.communityModerator.count({ where: { status: 'PENDING' } }),
        ]);

        // Daily aggregates for charts (last 14 days)
        const dailyQuery = (table: string, dateCol = 'created_at') => prisma.$queryRawUnsafe<{ date: string; count: bigint }[]>(
          `SELECT DATE(${dateCol}) as date, COUNT(*) as count FROM ${table} WHERE ${dateCol} >= $1 GROUP BY DATE(${dateCol}) ORDER BY date`,
          twoWeeksAgo,
        );
        const [dailyPostsRaw, dailyUsersRaw, dailyMsgsRaw] = await Promise.all([
          dailyQuery('posts'),
          dailyQuery('users'),
          dailyQuery('messages'),
        ]);

        // Fill missing days
        const fillDays = (raw: { date: string; count: bigint }[]) => {
          const map = new Map(raw.map(r => [new Date(r.date).toISOString().slice(0, 10), Number(r.count)]));
          const result: { date: string; count: number }[] = [];
          for (let i = 13; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const key = d.toISOString().slice(0, 10);
            result.push({ date: key, count: map.get(key) || 0 });
          }
          return result;
        };

        res.json({
          users: { total: usersTotal, today: usersToday, thisWeek: usersWeek, thisMonth: usersMonth },
          posts: { total: postsTotal, today: postsToday, thisWeek: postsWeek, clips: postsClips, text: postsText },
          messages: { total: msgsTotal, today: msgsToday, thisWeek: msgsWeek },
          streamers: { total: streamersTotal, claimed: streamersClaimed, live: streamersLive },
          channels: { total: channelsGlobal + channelsStreamer, global: channelsGlobal, streamer: channelsStreamer },
          follows: { total: followsTotal },
          communities: { total: communitiesTotal },
          news: { total: newsTotal, published: newsPublished },
          // Bitwy, hot takes, predykcje i rankingi zniknęły razem z funkcjami.
          // Kafelki z ich zerami nie mówiły nic poza tym, że coś kiedyś było.
          // W ich miejsce liczby, które opisują ten serwis dzisiaj:
          // komentarze i to, co czeka na decyzję administratora.
          comments: { total: commentsTotal, today: commentsToday, thisWeek: commentsWeek },
          queue: { reports: reportsPending, moderators: moderatorsPending },
          dailyPosts: fillDays(dailyPostsRaw),
          dailyUsers: fillDays(dailyUsersRaw),
          dailyMessages: fillDays(dailyMsgsRaw),
        });
      } catch (err) {
        console.error('[Admin Stats]', err);
        res.status(500).json({ error: 'Failed to load stats' });
      }
    });

    // ── Scraper control API ──
    const scraperService = this.scraperService;

    adminRouter.get('/api/scraper/status', async (_req: any, res: any) => {
      try {
        const status = scraperService.getStatus();
        const sources = await prisma.rssSource.findMany({ orderBy: { id: 'asc' } });
        res.json({ ...status, sources });
      } catch (err) {
        res.status(500).json({ error: 'Failed to get scraper status' });
      }
    });

    adminRouter.post('/api/scraper/toggle', async (req: any, res: any) => {
      try {
        const status = scraperService.getStatus();
        if (status.isEnabled) {
          scraperService.disable();
          res.json({ message: 'Scraper disabled', isEnabled: false });
        } else {
          scraperService.enable();
          res.json({ message: 'Scraper enabled', isEnabled: true });
        }
      } catch (err) {
        res.status(500).json({ error: 'Failed to toggle scraper' });
      }
    });

    adminRouter.post('/api/scraper/trigger', async (_req: any, res: any) => {
      try {
        await scraperService.triggerNow();
        res.json({ message: 'Scrape completed successfully' });
      } catch (err) {
        res.status(500).json({ error: 'Scrape failed' });
      }
    });

    app.use('/admin', adminRouter);
    console.log('[Admin] AdminJS mounted at /admin');
  }
}
