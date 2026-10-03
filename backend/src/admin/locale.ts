/**
 * Polska wersja panelu administracyjnego.
 *
 * AdminJS wyświetla domyślnie angielskie etykiety kolumn wprost z nazw pól
 * w bazie — „isNsfw", „streamerProfileId", „hotScore". Dla kogoś, kto nie
 * zna schematu, to nie jest interfejs, tylko zrzut tabeli.
 *
 * Trzymamy to w osobnym pliku, bo `admin.service.ts` i tak ma pod tysiąc
 * wierszy, a tłumaczenia rosną przy każdym nowym zasobie.
 *
 * Klucz `resources.<Model>.properties.<pole>` nadaje nazwę kolumnie
 * i etykiecie w formularzu. Podpowiedzi „co tu wpisać" to osobna rzecz:
 * siedzą przy zasobach jako `description` i renderują się pod polem.
 */
export const PL_TRANSLATIONS = {
  actions: {
    new: 'Dodaj',
    edit: 'Edytuj',
    show: 'Podgląd',
    delete: 'Usuń',
    bulkDelete: 'Usuń zaznaczone',
    list: 'Lista',
    search: 'Szukaj',
  },
  buttons: {
    save: 'Zapisz',
    addNewItem: 'Dodaj nowy',
    filter: 'Filtruj',
    applyChanges: 'Zastosuj',
    resetFilter: 'Wyczyść filtry',
    confirmRemovalMany_1: 'Potwierdź usunięcie jednego wpisu',
    confirmRemovalMany_other: 'Potwierdź usunięcie {{count}} wpisów',
    logout: 'Wyloguj',
    login: 'Zaloguj',
    seeTheDocumentation: 'Dokumentacja',
    createFirstRecord: 'Dodaj pierwszy wpis',
  },
  labels: {
    navigation: 'Nawigacja',
    pages: 'Strony',
    selectedRecords: 'Zaznaczone: {{selected}}',
    filters: 'Filtry',
    adminVersion: 'Wersja panelu',
    appVersion: 'Wersja aplikacji',
    loginWelcome: 'Panel administracyjny XDTV',
    dashboard: 'Pulpit',
  },
  /*
   * Nazwy stron w menu bocznym.
   *
   * Osobna przestrzeń od `labels` — AdminJS tłumaczy je przez
   * `translatePage(name)`, nie `translateLabel`. Wpis w `labels` nie
   * działał i w menu stał surowy identyfikator „Undernet".
   */
  pages: {
    undernet: 'Pulpit UNDERNET.ONE',
  },

  messages: {
    successfullyCreated: 'Wpis utworzony',
    successfullyUpdated: 'Zmiany zapisane',
    successfullyDeleted: 'Wpis usunięty',
    thereWereValidationErrors: 'Popraw zaznaczone pola',
    forbiddenError: 'Brak uprawnień do tej operacji',
    anyForbiddenError: 'Brak uprawnień do tej operacji',
    somethingWentWrong: 'Coś poszło nie tak',
    noRecords: 'Brak wpisów',
    noRecordsInResource: 'W tym zasobie nie ma jeszcze żadnych wpisów',
    confirmDelete: 'Na pewno usunąć ten wpis? Tej operacji nie da się cofnąć.',
    loading: 'Wczytywanie…',
    loginWelcome: 'Zaloguj się kontem administratora',
    invalidCredentials: 'Nieprawidłowy adres e-mail lub hasło',
  },
  properties: {
    id: 'ID',
    createdAt: 'Utworzono',
    updatedAt: 'Zmieniono',
    isActive: 'Aktywny',
    name: 'Nazwa',
    slug: 'Adres (slug)',
    description: 'Opis',
    email: 'E-mail',
    role: 'Rola',
    reason: 'Powód',
    status: 'Status',
    type: 'Typ',
    content: 'Treść',
    title: 'Tytuł',
    position: 'Kolejność',
    language: 'Język',
    category: 'Kategoria',
  },
  resources: {
    /*
     * Zasoby undernetu tłumaczy się po ICH identyfikatorze, nie po nazwie
     * modelu — inaczej wpis trafiłby do zasobu xdtv o tej samej nazwie.
     */
    UndernetSwitch: {
      properties: {
        key: 'Klucz',
        label: 'Przełącznik',
        enabled: 'Włączone',
        description: 'Opis',
        updatedAt: 'Zmieniono',
      },
    },
    UndernetUser: {
      properties: {
        username: 'Nazwa konta',
        displayName: 'Nazwa wyświetlana',
        isPro: 'PRO',
        proUntil: 'PRO do',
        stripeCustomerId: 'Klient Stripe',
        stripeSubscriptionId: 'Subskrypcja Stripe',
        stripeStatus: 'Stan w Stripe',
        bio: 'O sobie',
        website: 'Strona',
        location: 'Lokalizacja',
        nameColor: 'Kolor nicku',
        nameStyle: 'Styl nicku',
        avatarRing: 'Otoczka awatara',
      },
      /*
       * Nazwy akcji własnych. AdminJS nie czyta `label` z opisu akcji —
       * bierze tłumaczenie po kluczu `resources.<id>.actions.<akcja>`,
       * a bez wpisu wyświetla samą nazwę funkcji rozbitą na wyrazy
       * („Nadaj Pro", „Reset Password") pośród polskich przycisków.
       */
      actions: {
        nadajPro: 'Nadaj PRO na rok',
        odbierzPro: 'Odbierz PRO',
        resetPassword: 'Resetuj hasło',
      },
    },
    UndernetPremium: {
      properties: {
        key: 'Klucz',
        name: 'Nazwa',
        description: 'Opis',
        position: 'Kolejność',
        requiresPremium: 'Wymaga PRO',
      },
    },
    UndernetMedia: {
      properties: {
        url: 'Podgląd',
        filename: 'Nazwa pliku',
        mimeType: 'Format',
        sizeBytes: 'Rozmiar (B)',
        alt: 'Opis alternatywny',
        caption: 'Podpis',
        uploadedBy: 'Wgrał',
        width: 'Szerokość',
        height: 'Wysokość',
      },
    },
    User: {
      properties: {
        username: 'Nazwa użytkownika',
        displayName: 'Nazwa wyświetlana',
        avatarUrl: 'Adres awatara',
        isEmailVerified: 'E-mail potwierdzony',
        lastActiveAt: 'Ostatnia aktywność',
        twitchId: 'ID Twitch',
        kickId: 'ID Kick',
        youtubeId: 'ID YouTube',
      },
    },
    StreamerProfile: {
      properties: {
        bio: 'Opis profilu',
        bannerUrl: 'Adres banera',
        twitchUrl: 'Profil Twitch',
        youtubeUrl: 'Profil YouTube',
        kickUrl: 'Profil Kick',
        twitterUrl: 'Profil X',
        isClaimed: 'Przejęty przez właściciela',
        isVerified: 'Zweryfikowany',
        isLive: 'Nadaje teraz',
        chatEnabled: 'Czat włączony',
        viewCount: 'Wyświetlenia',
        followerCount: 'Obserwujący',
      },
    },
    Post: {
      properties: {
        author: 'Autor',
        community: 'Społeczność',
        streamerProfile: 'Streamer',
        isOfficial: 'Oficjalny',
        isNsfw: 'Treść dla dorosłych',
        isFlagged: 'Zgłoszony automatycznie',
        isPinned: 'Przypięty',
        isDeleted: 'Usunięty',
        imageUrl: 'Adres obrazka',
        linkUrl: 'Adres odnośnika',
        videoUrl: 'Adres wideo',
        thumbnailUrl: 'Adres miniatury',
        clipSource: 'Źródło klipu',
        externalId: 'ID zewnętrzne',
        duration: 'Długość (sekundy)',
        viewCount: 'Wyświetlenia',
        upvotes: 'Głosy w górę',
        downvotes: 'Głosy w dół',
        commentCount: 'Komentarze',
        hotScore: 'Wynik popularności',
      },
    },
    Community: {
      properties: {
        iconUrl: 'Adres ikony',
        bannerUrl: 'Adres banera',
        color: 'Kolor',
        isOfficial: 'Oficjalna',
        rules: 'Regulamin',
        postCount: 'Liczba postów',
        memberCount: 'Liczba członków',
        createdBy: 'Założyciel',
      },
    },
    News: {
      properties: {
        summary: 'Zajawka',
        titleEn: 'Tytuł (angielski)',
        summaryEn: 'Zajawka (angielska)',
        contentEn: 'Treść (angielska)',
        sourceUrl: 'Adres źródła',
        sourceName: 'Nazwa źródła',
        imageUrl: 'Adres obrazka',
        isPublished: 'Opublikowany',
        publishedAt: 'Data publikacji',
        commentCount: 'Komentarze',
      },
    },
    RssSource: {
      properties: {
        url: 'Adres kanału RSS',
        lastScrapedAt: 'Ostatnie pobranie',
        articlesCount: 'Pobranych artykułów',
      },
    },
    Channel: {
      properties: {
        scope: 'Zasięg',
        streamerProfile: 'Streamer',
        sortOrder: 'Kolejność',
      },
    },
    Message: {
      properties: {
        channel: 'Kanał',
        author: 'Autor',
        isPinned: 'Przypięta',
        isDeleted: 'Usunięta',
      },
    },
    ChannelMute: {
      properties: {
        channel: 'Kanał',
        user: 'Wyciszony',
        mutedBy: 'Wyciszył',
        expiresAt: 'Wygasa',
      },
    },
    ChannelBan: {
      properties: {
        channel: 'Kanał',
        user: 'Zablokowany',
        bannedBy: 'Zablokował',
      },
    },
    ChatEmoji: {
      properties: {
        code: 'Kod w czacie',
        url: 'Adres obrazka',
        isAnimated: 'Animowana',
        isGlobal: 'Dostępna wszędzie',
        isPremium: 'Tylko dla premium',
        streamerProfile: 'Streamer',
      },
    },
    Report: {
      properties: {
        reporter: 'Zgłaszający',
        targetType: 'Typ zgłoszonego',
        targetId: 'ID zgłoszonego',
        adminNote: 'Notatka administratora',
        resolvedBy: 'Rozpatrzył',
      },
    },
    Follow: {
      properties: {
        user: 'Obserwujący',
        streamerProfile: 'Obserwowany streamer',
        tag: 'Obserwowany tag',
        post: 'Obserwowany post',
      },
    },
    Tag: {
      properties: {
        color: 'Kolor',
        postCount: 'Liczba postów',
      },
    },
    AdSlot: {
      properties: {
        key: 'Klucz (nie do zmiany)',
        code: 'Kod reklamy',
      },
    },
    AdminActionLog: {
      properties: {
        user: 'Kto',
        action: 'Co zrobił',
        targetType: 'Typ obiektu',
        targetId: 'ID obiektu',
        metadata: 'Szczegóły',
        ipAddress: 'Adres IP',
        userAgent: 'Przeglądarka',
      },
    },
  },
} as const;
