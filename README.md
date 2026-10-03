# XDTV.fans

Polskie centrum streamingu: profile streamerów, klipy, transmisje na żywo
i społeczności, w których toczą się dyskusje wokół sceny.

Działa produkcyjnie pod **[xdtv.fans](https://xdtv.fans)**.

## Co jest w środku

| Obszar | Co robi |
| --- | --- |
| Streamerzy | katalog profili z Twitcha, YouTube'a, Kicka i TikToka; przejmowanie profilu przez samego streamera |
| Synchronizacja platform | proces w tle: status „na żywo” co 2 min, liczba obserwujących i tytuły co 30 min |
| Klipy i live | ściana klipów, lista transmisji trwających teraz |
| Społeczności | społeczności z moderatorami, posty, komentarze, głosowanie, reakcje emoji |
| Czat | kanały i wiadomości na żywo (Socket.IO) |
| Newsy | wiadomości ze sceny, z tłumaczeniem na angielski |
| Zaangażowanie | codzienne wyzwania, serie aktywności, sklep |
| Konto | rejestracja z potwierdzeniem e-mail, logowanie przez Discord, Google, Twitch i inne |
| Monetyzacja | Stripe (subskrypcje w trzech progach), bloki reklamowe z panelu |
| Panel | AdminJS pod `/admin`, wspólny z [UNDERNET.ONE](https://github.com/V-SGFX/undernet.one-v2) |

## Technologie

**backend/** — API

- NestJS 11, TypeScript
- PostgreSQL + Prisma 6
- Redis i BullMQ (kolejki, cache)
- Socket.IO, Passport/JWT, Nodemailer, Stripe
- AdminJS 7

**frontend/** — strona

- Next.js 16 (App Router), React 19
- TanStack Query, Tailwind CSS, Framer Motion
- next-intl (polski i angielski)

## Uruchomienie lokalne

Wymagania: Node.js 20+, PostgreSQL, Redis.

```bash
# API
cd backend
cp .env.example .env          # uzupełnij pola WPISZ_
npm ci
npx prisma migrate deploy
npm run seed
npm run start:dev             # http://localhost:4000

# strona
cd ../frontend
cp .env.example .env.local
npm ci
npm run dev                   # http://localhost:3000
```

Wszystkie zmienne są opisane w `backend/.env.example` i
`frontend/.env.example`. Klucze platform (Twitch, YouTube, Kick, TikTok),
logowanie zewnętrzne, poczta i Stripe są opcjonalne: bez nich dana
funkcja jest wyłączona.

Skrypty w `backend/scripts/` służą do jednorazowego zasilania katalogu
(import streamerów i klipów z platform). Klucze API czytają wyłącznie
z `.env`.

### Produkcja

```bash
cd backend  && npm run build && npm start
cd frontend && npm run build && npm start
```

Przed oboma procesami stoi reverse proxy (u nas nginx): `/api/`,
`/uploads/`, `/socket.io/` i `/admin` kierujemy do API, resztę do Next.js.

## Wspólny panel z UNDERNET.ONE

Panel AdminJS obsługuje obie bazy. Drugi klient Prisma korzysta z kopii
schematu undernetu w `backend/prisma/undernet/schema.prisma`. Tego pliku
nie edytuje się ręcznie, tylko odświeża skryptem:

```bash
node scripts/sync-undernet-schema.mjs
```

Bez `UNDERNET_DATABASE_URL` sekcje undernetu w panelu się nie pojawiają.

## Struktura

```
backend/
  prisma/            schemat, migracje, kopia schematu undernetu
  scripts/           import streamerów i klipów, synchronizacja schematu
  src/<moduł>/       moduły NestJS (streamers, platform-sync, communities, gateway, admin, …)
frontend/
  messages/          tłumaczenia pl / en
  src/app/           trasy Next.js
  src/components/    komponenty interfejsu
  src/lib/           klient API, kontekst logowania, typy
```

## Licencja

Kod udostępniony do wglądu. Wszystkie prawa zastrzeżone. W sprawie
wykorzystania napisz przez GitHub: [@V-SGFX](https://github.com/V-SGFX).
