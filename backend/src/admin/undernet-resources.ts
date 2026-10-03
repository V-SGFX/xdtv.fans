/* eslint-disable @typescript-eslint/no-explicit-any -- granica z modułem
 * generowanym poza standardową ścieżką, bez typów w czasie kompilacji. */

/**
 * Zasoby sekcji UNDERNET.ONE we wspólnym panelu.
 *
 * Wydzielone z `admin.service.ts`, bo ten plik ma już ponad tysiąc wierszy,
 * a lista zasobów drugiego serwisu rośnie niezależnie od pierwszego.
 *
 * Nazwy grup nawigacji są poprzedzone „UNDERNET.ONE —", bo AdminJS ma jedną
 * płaską przestrzeń nazw grup: grupa „Users" z undernetu scaliłaby się
 * z grupą „Users" z xdtv i wymieszałaby użytkowników obu serwisów
 * w jednym menu. Bazy pozostają osobne, ale menu wyglądałoby na wspólne.
 */
interface Widoki {
  /** Miniatura pliku na liście mediów. */
  mediaThumb?: string;
  /** Duży podgląd z listą użyć na karcie pliku. */
  mediaPreview?: string;
  /** Skąd serwowane są pliki undernetu — adres MUSI być bezwzględny. */
  publicUrl?: string;
}

export function undernetResources(
  getModelByName: any,
  client: any,
  clientModule: any,
  widoki: Widoki = {},
) {
  const model = (name: string) => ({ model: getModelByName(name, clientModule), client });

  /*
   * Wartości list wyboru bierzemy z DMMF UNDERNETU, nie z domyślnego.
   *
   * Adapter @adminjs/prisma czyta enumy z `clientModule` przekazanego
   * w opisie zasobu. Nie da się go tam włożyć: AdminJS scala opisy
   * lodashem, a ten sonduje `.length`, na czym proxy klienta Prismy
   * wywraca się z „Invalid enum value: length" i panel przestaje wstawać.
   *
   * Bez tego adapter cofał się do domyślnego `Prisma.dmmf`, czyli schematu
   * XDTV — i formularz użytkownika undernetu pokazywał role xdtv:
   * USER, STREAMER, MODERATOR, ADMIN. Brakowało AUTHOR i EDITOR, czyli
   * dokładnie tych dwóch, na których stoi obieg redakcyjny; nie dało się
   * ich nikomu nadać z panelu.
   *
   * To samo dotyczyło ContentType i ContentStatus — enumów, których xdtv
   * w ogóle nie ma, więc typ i etap materiału renderowały się jako pole
   * tekstowe zamiast listy.
   */
  const ENUMY: Record<string, string[]> = Object.fromEntries(
    (clientModule?.Prisma?.dmmf?.datamodel?.enums ?? []).map((e: any) => [
      e.name,
      (e.values ?? []).map((v: any) => String(v.name)),
    ]),
  );

  /** Pola wyliczeniowe modelu, z wartościami ze schematu undernetu. */
  const enumProps = (modelName: string): Record<string, any> => {
    const dmmf = getModelByName(modelName, clientModule);
    const out: Record<string, any> = {};
    for (const field of dmmf.fields ?? []) {
      if (field.kind !== 'enum') continue;
      const values = ENUMY[field.type];
      if (values?.length) out[field.name] = { availableValues: values.map((v) => ({ value: v, label: v })) };
    }
    return out;
  };

  /*
   * Relacje MUSZĄ wskazywać na nasze identyfikatory, nie na nazwy modeli.
   *
   * AdminJS rozwiązuje pole referencyjne po identyfikatorze ZASOBU, a ten
   * domyślnie równa się nazwie modelu Prismy. Zasobom undernetu nadaliśmy
   * własne nazwy — inaczej „User" z undernetu zderzyłby się z „User"
   * z xdtv — więc panel szukał zasobu „Author", „ContentCategory" czy
   * „ContentItem" i wywalał się z `There are no resources with given id`.
   *
   * Padało na tym nie tylko rozwijane pole w formularzu. LISTA też, bo
   * kolumna `author` jest referencją i AdminJS sięga po zasób docelowy,
   * żeby ją wyrenderować — stąd 500 na UndernetContent, UndernetComment
   * i UndernetCategory przy samym wejściu.
   */
  const REF: Record<string, string> = {
    User: 'UndernetUser',
    Community: 'UndernetCommunity',
    Post: 'UndernetPost',
    Comment: 'UndernetComment',
    ContentItem: 'UndernetContent',
    Author: 'UndernetAuthor',
    ContentCategory: 'UndernetCategory',
    Tag: 'UndernetTag',
    MediaAsset: 'UndernetMedia',
    EditorialReview: 'UndernetEditorial',
    ContentRevision: 'UndernetRevision',
    AdSlot: 'UndernetAdSlot',
    RssSource: 'UndernetRssSource',
    PremiumFeature: 'UndernetPremium',
    SiteSetting: 'UndernetSwitch',
  };

  /**
   * Właściwości relacyjne modelu, przepisane na nasze identyfikatory.
   *
   * Mapa powstaje z DMMF, a nie z ręcznej listy: schemat undernetu ma
   * kilkadziesiąt relacji i przy każdej nowej trzeba by pamiętać o dopisaniu
   * wyjątku. Tutaj nowa relacja obsługuje się sama.
   *
   * Relacje do modeli, których w panelu NIE MA — Follow, Vote, PostTag,
   * Notification i reszta warstwy technicznej — chowamy. AdminJS nie umie
   * ich wyrenderować, a próba kończy się dokładnie tym samym błędem.
   */
  const relationProps = (modelName: string): Record<string, any> => {
    const dmmf = getModelByName(modelName, clientModule);
    const out: Record<string, any> = {};
    for (const field of dmmf.fields ?? []) {
      if (field.kind !== 'object' || !field.relationName) continue;
      const target = REF[field.type];
      out[field.name] = target ? { reference: target } : { isVisible: false };
    }
    return out;
  };

  /**
   * Zasób undernetu: nazwa modelu plus opcje.
   *
   * Właściwości relacyjne dokładane są automatycznie, a ręczne opisy pól
   * scalane klucz po kluczu — opis nie kasuje przekierowania ani odwrotnie.
   */
  const res = (modelName: string, options: Record<string, any>) => {
    const properties: Record<string, any> = { ...relationProps(modelName), ...enumProps(modelName) };
    for (const [key, value] of Object.entries(options.properties ?? {})) {
      properties[key] = { ...(properties[key] ?? {}), ...(value as object) };
    }
    return { resource: model(modelName), options: { ...options, properties } };
  };

  const NAV = {
    community: { name: 'UNDERNET.ONE — Społeczność', icon: 'Users' },
    knowledge: { name: 'UNDERNET.ONE — Wiedza', icon: 'Book' },
    editorial: { name: 'UNDERNET.ONE — Redakcja', icon: 'Edit' },
    config: { name: 'UNDERNET.ONE — Konfiguracja', icon: 'Settings' },
    money: { name: 'UNDERNET.ONE — Monetyzacja', icon: 'DollarSign' },
  };

  return [
    // ── Społeczność ────────────────────────────────────────────────
    res('User', {
      id: 'UndernetUser',
      navigation: NAV.community,
      listProperties: ['id', 'username', 'email', 'role', 'isPro', 'proUntil', 'isActive', 'createdAt'],
      editProperties: ['username', 'displayName', 'email', 'role', 'isActive', 'isPro', 'proUntil'],
      filterProperties: ['role', 'isPro', 'isActive'],
      /**
       * Wymuszony reset hasła.
       *
       * Administrator nie musi znać cudzego hasła, żeby je zmienić — i nie
       * powinien. Akcja unieważnia bieżące hasło i wysyła użytkownikowi
       * link, którym nada sobie nowe. Sama zmiana idzie przez API
       * undernetu, bo to stamtąd wychodzi list z właściwym nadawcą
       * i adresem na undernet.one; panel pisałby po bazie na ślepo.
       */
      actions: {
        resetPassword: {
          actionType: 'record' as const,
          icon: 'Key',
          label: 'Resetuj hasło',
          guard: 'Unieważnić hasło i wysłać użytkownikowi link do ustawienia nowego?',
          isVisible: true,
          handler: async (_request: any, _response: any, context: any) => {
            const { record, currentAdmin } = context;
            const id = record?.param('id');

            const base = process.env.UNDERNET_API_URL ?? 'http://127.0.0.1:4100';
            const secret = process.env.UNDERNET_ADMIN_SECRET;

            if (!secret) {
              return {
                record: record.toJSON(currentAdmin),
                notice: { message: 'Brak UNDERNET_ADMIN_SECRET w konfiguracji panelu.', type: 'error' },
              };
            }

            try {
              const res = await fetch(`${base}/api/auth/admin/force-password-reset`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-admin-secret': secret },
                body: JSON.stringify({ userId: Number(id) }),
                signal: AbortSignal.timeout(15000),
              });
              const data: any = await res.json().catch(() => ({}));

              if (!res.ok) {
                return {
                  record: record.toJSON(currentAdmin),
                  notice: { message: data?.message ?? `Nie udało się (HTTP ${res.status}).`, type: 'error' },
                };
              }

              return {
                record: record.toJSON(currentAdmin),
                notice: {
                  message: `Hasło unieważnione. Link do ustawienia nowego poszedł na ${data.email}. Ważny 24 godziny.`,
                  type: 'success',
                },
              };
            } catch (e: any) {
              return {
                record: record.toJSON(currentAdmin),
                notice: { message: `Backend undernetu nie odpowiedział: ${e?.message ?? 'brak połączenia'}`, type: 'error' },
              };
            }
          },
          component: false,
        },

        /*
         * Nadanie i odebranie PRO z panelu.
         *
         * Skróty obok pól w formularzu, bo „daj temu koncie PRO na rok"
         * to jedna decyzja, a nie dwa pola do wypełnienia (przełącznik
         * plus data) — a przy ręcznym wpisywaniu daty łatwo o pomyłkę
         * o rok albo o strefę czasową.
         *
         * Piszemy prosto do bazy, nie przez API undernetu: to nadanie
         * przywileju, a nie płatność — nie ma tu maila do wysłania ani
         * niczego, co musiałoby przejść przez tamtą warstwę.
         */
        nadajPro: {
          actionType: 'record' as const,
          icon: 'Star',
          label: 'Nadaj PRO na rok',
          guard: 'Nadać temu kontu UNDERNET PRO na rok?',
          isVisible: true,
          handler: async (_request: any, _response: any, context: any) => {
            const { record, currentAdmin } = context;
            const id = Number(record?.param('id'));
            const doKiedy = new Date();
            doKiedy.setFullYear(doKiedy.getFullYear() + 1);

            try {
              const przed = await client.user.findUnique({
                where: { id },
                select: { username: true, stripeSubscriptionId: true, stripeStatus: true },
              });

              await client.user.update({
                where: { id },
                data: { isPro: true, proUntil: doKiedy },
              });

              /*
               * Ostrzeżenie, a nie blokada.
               *
               * Jeśli konto ma subskrypcję w Stripe, najbliższy webhook
               * (odnowienie, rezygnacja) nadpisze to, co tu ustawiliśmy.
               * Bywa, że właśnie o to chodzi — np. gratis po reklamacji —
               * więc nie zabraniamy, tylko mówimy wprost.
               */
              const uwaga = przed?.stripeSubscriptionId
                ? ' UWAGA: konto ma subskrypcję w Stripe — kolejny webhook nadpisze to ustawienie.'
                : '';

              return {
                record: (await context.resource.findOne(id)).toJSON(currentAdmin),
                notice: {
                  message: `PRO nadane do ${doKiedy.toLocaleDateString('pl-PL')}.${uwaga}`,
                  type: przed?.stripeSubscriptionId ? 'info' : 'success',
                },
              };
            } catch (e: any) {
              return {
                record: record.toJSON(currentAdmin),
                notice: { message: `Nie udało się nadać PRO: ${e?.message}`, type: 'error' },
              };
            }
          },
          component: false,
        },

        odbierzPro: {
          actionType: 'record' as const,
          icon: 'X',
          label: 'Odbierz PRO',
          guard: 'Odebrać temu kontu UNDERNET PRO ze skutkiem natychmiastowym?',
          isVisible: true,
          handler: async (_request: any, _response: any, context: any) => {
            const { record, currentAdmin } = context;
            const id = Number(record?.param('id'));
            try {
              const przed = await client.user.findUnique({
                where: { id },
                select: { stripeSubscriptionId: true },
              });

              // `proUntil` czyścimy razem z przełącznikiem. Zostawiona data
              // z przyszłości wyglądałaby przy wyłączonym PRO jak błąd
              // i kusiła, żeby „naprawić" ją z powrotem na włączone.
              await client.user.update({
                where: { id },
                data: { isPro: false, proUntil: null },
              });

              return {
                record: (await context.resource.findOne(id)).toJSON(currentAdmin),
                notice: {
                  message: przed?.stripeSubscriptionId
                    ? 'PRO odebrane. Konto ma subskrypcję w Stripe — jeśli jest aktywna, anuluj ją też po tamtej stronie, inaczej wróci przy najbliższym webhooku.'
                    : 'PRO odebrane.',
                  type: przed?.stripeSubscriptionId ? 'info' : 'success',
                },
              };
            } catch (e: any) {
              return {
                record: record.toJSON(currentAdmin),
                notice: { message: `Nie udało się odebrać PRO: ${e?.message}`, type: 'error' },
              };
            }
          },
          component: false,
        },
      },
      properties: {
        passwordHash: { isVisible: false },
        role: {
          /*
           * STREAMER świadomie POZA listą.
           *
           * Wartość została w enumie po szkielecie xdtv i nic jej nie
           * używa; usunięcie z bazy wymagałoby przebudowy typu na żywej
           * kolumnie bez żadnego zysku. Ale zostawiona w liście wyboru
           * jest zaproszeniem do nadania roli, która w tym serwisie nic
           * nie znaczy — więc pokazujemy tylko role, które coś robią.
           */
          availableValues: [
            { value: 'USER', label: 'USER — czyta, pisze na forum, proponuje hasła wiki' },
            { value: 'AUTHOR', label: 'AUTHOR — tworzy materiały i zgłasza do akceptacji' },
            { value: 'EDITOR', label: 'EDITOR — akceptuje, redaguje i publikuje' },
            { value: 'MODERATOR', label: 'MODERATOR — moderuje społeczność, zatwierdza materiały' },
            { value: 'ADMIN', label: 'ADMIN — pełny dostęp' },
          ],
          description: 'Zwykłe konto pisze na forum i może zaproponować hasło wiki — trafia ono do akceptacji. AUTHOR pisze też artykuły i instrukcje. Akceptują EDITOR, MODERATOR i ADMIN.',
        },
        isPro: {
          label: 'PRO',
          description: 'Czy konto ma UNDERNET PRO. Odblokowuje wyłącznie funkcje przełączone na „wymaga PRO" w sekcji Monetyzacja — reszta i tak jest dostępna dla wszystkich. Konto z subskrypcją w Stripe: kolejny webhook nadpisze ręczną zmianę.',
        },
        proUntil: {
          label: 'PRO do',
          description: 'Do kiedy ważne. PUSTE znaczy BEZTERMINOWO — tak wygląda dostęp nadany ręcznie, np. dla redakcji. Data z przeszłości działa jak brak PRO.',
        },
        stripeCustomerId: { isVisible: { list: false, filter: false, show: true, edit: false } },
        stripeSubscriptionId: { isVisible: { list: false, filter: false, show: true, edit: false } },
        stripeStatus: {
          label: 'Stan w Stripe',
          isVisible: { list: false, filter: true, show: true, edit: false },
          description: 'Stan subskrypcji prosto ze Stripe. Tylko do odczytu — źródłem prawdy jest Stripe, nie panel.',
        },
      },
    }),
    res('Community', {
      id: 'UndernetCommunity',
      navigation: NAV.community,
      listProperties: ['id', 'name', 'slug', 'postCount', 'memberCount', 'isOfficial'],
      filterProperties: ['isOfficial'],
      properties: {
        slug: { description: 'Fragment adresu: /community?community=TO-POLE. Małe litery i myślniki.' },
      },
    }),
    res('Post', {
      id: 'UndernetPost',
      navigation: NAV.community,
      listProperties: ['id', 'title', 'type', 'author', 'community', 'upvotes', 'isDeleted', 'createdAt'],
      filterProperties: ['type', 'isDeleted', 'community'],
      properties: {
        isPinned: { description: 'Przypięty trafia na górę SWOJEJ społeczności. Poza nią nie ma znaczenia.' },
      },
    }),
    res('Comment', {
      id: 'UndernetComment',
      navigation: NAV.community,
      listProperties: ['id', 'author', 'content', 'isDeleted', 'createdAt'],
      filterProperties: ['isDeleted'],
    }),

    // ── Wiedza ─────────────────────────────────────────────────────
    res('ContentItem', {
      id: 'UndernetContent',
      navigation: NAV.knowledge,
      listProperties: ['id', 'type', 'status', 'title', 'author', 'category', 'publishedAt'],
      filterProperties: ['type', 'status', 'category', 'author'],
      editProperties: [
        'type', 'status', 'title', 'slug', 'excerpt', 'body', 'coverUrl',
        'author', 'category', 'sourcePost',
        'metaTitle', 'metaDescription', 'canonicalUrl', 'ogTitle', 'ogDescription', 'ogImage',
      ],
      properties: {
        type: { description: 'NEWS, ARTICLE, HOWTO albo WIKI. Wiki, How To i Artykuły to ten sam wiersz z innym typem — filtr wyżej rozdziela je na listy.' },
        status: { description: 'DRAFT — szkic. REVIEW — czeka na akceptację. PUBLISHED — widoczny publicznie. ARCHIVED — wycofany, ale zachowany.' },
        slug: { description: 'Fragment adresu, unikalny w obrębie typu. /wiki/docker i /how-to/docker mogą istnieć obok siebie.' },
        body: { type: 'textarea', props: { rows: 20 }, description: 'Treść jako HTML z edytora Studia. Backend czyści ją przy zapisie.' },
        excerpt: { type: 'textarea', props: { rows: 3 }, description: 'Zajawka na kafelku i w wynikach wyszukiwania.' },
        coverUrl: { description: 'Grafika nad tekstem i na kafelku. Wgraj ją w Studiu — tutaj wpisuje się gotowy adres.' },
        sourcePost: { description: 'Wątek forum, z którego materiał powstał. To pole rysuje na stronie sekcję „Źródło dyskusji" — sedno idei portalu.' },
        metaTitle: { description: 'Tytuł w wyszukiwarce. Puste = użyty zostanie tytuł materiału.' },
        metaDescription: { type: 'textarea', props: { rows: 2 }, description: 'Opis w wynikach wyszukiwania. Puste = zajawka.' },
        ogImage: { description: 'Obrazek przy udostępnieniu w mediach społecznościowych. Puste = okładka.' },
        readingTime: { isDisabled: true, description: 'Liczony automatycznie przy zapisie treści.' },
      },
    }),
    res('Author', {
      id: 'UndernetAuthor',
      navigation: NAV.knowledge,
      listProperties: ['id', 'name', 'slug', 'user', 'createdAt'],
      properties: {
        user: { description: 'Konto w serwisie. Puste jest poprawne: autorem bywa osoba bez konta — gość, redakcja, autor historyczny.' },
        website: { description: 'Adres strony autora. Pokazywany na jego profilu.' },
      },
    }),
    res('ContentCategory', {
      id: 'UndernetCategory',
      navigation: NAV.knowledge,
      listProperties: ['id', 'name', 'slug', 'parent', 'position'],
      properties: {
        parent: { description: 'Kategoria nadrzędna. Puste = kategoria główna. Drzewo: Linux → Sieci → VPN.' },
        position: { description: 'Kolejność wśród rodzeństwa. Mniejsza liczba wyżej.' },
      },
    }),
    res('Tag', {
      id: 'UndernetTag',
      navigation: NAV.knowledge,
      listProperties: ['id', 'name', 'slug', 'type', 'postCount'],
      filterProperties: ['type'],
      properties: {
        slug: { description: 'Te same tagi opisują wątki forum i materiały bazy wiedzy — nie ma osobnego systemu dla żadnego z nich.' },
      },
    }),
    /*
     * Przegląd mediów.
     *
     * Kolumna `url` renderuje MINIATURĘ, nie adres. Nazwy plików są losowe
     * z rozmysłem — adres nigdy się nie powtarza — więc lista nazw
     * w rodzaju `e1493c5ba8ca8d57d3905f5c.webp` nie pozwalała rozpoznać
     * ani jednego obrazka.
     *
     * Karta pliku pokazuje duży podgląd i listę użyć: bez niej nie wiadomo,
     * czy plik wolno skasować.
     */
    res('MediaAsset', {
      id: 'UndernetMedia',
      navigation: NAV.knowledge,
      listProperties: ['url', 'sizeBytes', 'createdAt', 'uploadedBy'],
      showProperties: ['url', 'filename', 'alt', 'caption', 'mimeType', 'sizeBytes', 'uploadedBy', 'createdAt'],
      editProperties: ['alt', 'caption'],
      filterProperties: ['mimeType', 'createdAt'],
      properties: {
        url: {
          position: 1,
          isTitle: true,
          custom: { base: widoki.publicUrl ?? 'https://undernet.one' },
          ...(widoki.mediaThumb || widoki.mediaPreview
            ? {
                components: {
                  ...(widoki.mediaThumb && { list: widoki.mediaThumb }),
                  ...(widoki.mediaPreview && { show: widoki.mediaPreview }),
                },
              }
            : {}),
        },
        filename: { description: 'Nazwa nadana przy zapisie. Losowa, żeby adres nigdy się nie powtórzył.' },
        sizeBytes: { description: 'Rozmiar po konwersji do WebP, w bajtach.' },
        alt: { description: 'Tekst alternatywny — opisuje sam obrazek. Puste pole to obrazek niedostępny dla czytnika ekranu.' },
        caption: { description: 'Podpis widoczny pod obrazkiem. Opisuje kontekst, nie obrazek.' },
      },
      /*
       * Wgrywanie odbywa się w Studiu, przy pisaniu materiału — tam plik
       * od razu trafia w treść. Formularz „nowy" w panelu tworzyłby wpis
       * bez pliku na dysku.
       */
      actions: { new: { isAccessible: false } },
    }),

    // ── Redakcja ───────────────────────────────────────────────────
    res('EditorialReview', {
      id: 'UndernetEditorial',
      navigation: NAV.editorial,
      listProperties: ['id', 'contentItem', 'reviewer', 'fromStatus', 'toStatus', 'note', 'createdAt'],
      filterProperties: ['fromStatus', 'toStatus'],
      /*
       * Tylko do odczytu — bez wyjątku.
       *
       * To historia decyzji redakcyjnych. Dopisanie do niej wpisu ręcznie
       * albo skasowanie niewygodnego odbiera jej jedyną wartość: możliwość
       * odtworzenia, kto co zatwierdził i kiedy. Wiersze powstają wyłącznie
       * przy faktycznej zmianie etapu.
       */
      actions: {
        new: { isAccessible: false },
        edit: { isAccessible: false },
        delete: { isAccessible: false },
        bulkDelete: { isAccessible: false },
      },
    }),
    res('ContentRevision', {
      id: 'UndernetRevision',
      navigation: NAV.editorial,
      listProperties: ['id', 'contentItem', 'editor', 'title', 'summary', 'createdAt'],
      actions: {
        new: { isAccessible: false },
        edit: { isAccessible: false },
      },
    }),

    // ── Konfiguracja ───────────────────────────────────────────────
    /*
     * UNDERNET PRO — co jest płatne, a co darmowe.
     *
     * Jeden przełącznik na funkcję. WŁĄCZONY znaczy „tylko dla wykupionego
     * PRO", WYŁĄCZONY — „dostępne dla wszystkich, także darmowych kont".
     * Wszystkie zaczynają wyłączone.
     *
     * Lista jest w bazie, nie w kodzie, właśnie po to, żeby dała się zmienić
     * stąd, bez wdrożenia. Zakładanie i kasowanie pozycji jest odcięte:
     * `key` to kontrakt z kodem strony, a wiersz bez odpowiednika w kodzie
     * niczego nie włącza ani nie wyłącza — byłby przełącznikiem donikąd.
     */
    res('PremiumFeature', {
      id: 'UndernetPremium',
      navigation: NAV.money,
      listProperties: ['position', 'name', 'requiresPremium', 'key'],
      editProperties: ['requiresPremium', 'name', 'description', 'position'],
      filterProperties: ['requiresPremium'],
      properties: {
        requiresPremium: {
          description: 'WŁĄCZONE — funkcja tylko dla kont z wykupionym PRO. WYŁĄCZONE — dostępna dla wszystkich, także darmowych. Zmiana działa od razu, bez wdrożenia.',
        },
        key: {
          isDisabled: true,
          description: 'Nazwa używana w kodzie strony. Zmiana zerwałaby powiązanie i przełącznik przestałby cokolwiek robić.',
        },
        name: { description: 'Nazwa widoczna dla użytkownika, na cenniku i przy kłódce.' },
        description: { type: 'textarea', props: { rows: 2 }, description: 'Zdanie wyjaśniające, co ta funkcja daje.' },
        position: { description: 'Kolejność na liście i na cenniku. Mniejsza liczba wyżej.' },
      },
      actions: { new: { isAccessible: false }, delete: { isAccessible: false }, bulkDelete: { isAccessible: false } },
    }),
    /*
     * Przełączniki serwisu.
     *
     * Osobno od listy funkcji PRO, bo odpowiadają na inne pytanie: tamta
     * mówi „czy ta funkcja wymaga opłaty", ta „czy w ogóle o tym mówimy".
     * Razem wyglądałyby jak dziewiąta funkcja na stronie z cennikiem.
     */
    res('SiteSetting', {
      id: 'UndernetSwitch',
      navigation: NAV.config,
      listProperties: ['label', 'enabled', 'key', 'updatedAt'],
      editProperties: ['enabled'],
      filterProperties: ['enabled'],
      /*
       * Dodawanie i kasowanie wyłączone: klucz musi zgadzać się z kodem,
       * a wiersz dopisany z ręki byłby przełącznikiem, którego nic nie
       * czyta. Wiersze zakłada migracja, panel je tylko przestawia.
       */
      actions: { new: { isAccessible: false }, delete: { isAccessible: false }, bulkDelete: { isAccessible: false } },
      properties: {
        key: { isVisible: { list: true, filter: true, show: true, edit: false } },
        label: { isVisible: { list: true, filter: false, show: true, edit: false } },
        description: { isVisible: { list: false, filter: false, show: true, edit: false } },
        enabled: {
          description: 'Wyłączone chowa przycisk PRO w pasku, zamyka stronę /pro i wstrzymuje płatności. NIE zmienia dostępu do funkcji — tym sterują przełączniki „wymaga PRO" wyżej.',
        },
      },
    }),

    res('AdSlot', {
      id: 'UndernetAdSlot',
      navigation: NAV.money,
      listProperties: ['position', 'key', 'name', 'isActive', 'updatedAt'],
      editProperties: ['name', 'description', 'code', 'isActive', 'position'],
      properties: {
        key: { isDisabled: true, description: 'Kontrakt z kodem strony. Zmiana dałaby blok, którego nic nie wyrenderuje.' },
        code: { type: 'textarea', props: { rows: 12 }, description: 'Cały kod od dostawcy reklam, ze znacznikiem <script>.' },
      },
      actions: { new: { isAccessible: false }, delete: { isAccessible: false } },
    }),
    res('RssSource', {
      id: 'UndernetRssSource',
      navigation: NAV.config,
      listProperties: ['id', 'name', 'url', 'language', 'isActive', 'articlesCount'],
      properties: {
        url: { description: 'Pełny adres kanału RSS. Musi zwracać XML, nie stronę HTML.' },
        language: { description: 'Język oryginału: en albo pl. Decyduje, w którą stronę idzie tłumaczenie.' },
      },
    }),
  ];
}
