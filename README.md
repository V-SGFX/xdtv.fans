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
| Panel | AdminJS pod `/admin` — moderacja, konta, treści, monetyzacja |

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

## Instalacja

Wymagania: Node.js 20+, PostgreSQL (pusta baza), Redis.

Najprościej skryptem — pyta o domenę, bazę i konto administratora, losuje
sekrety, zakłada tabele, tworzy administratora i buduje obie części:

```bash
git clone https://github.com/V-SGFX/xdtv.fans.git
cd xdtv.fans
./install.sh
```

Hasło administratora podajesz przy instalacji i nigdzie nie jest zapisywane
(trafia tylko do seeda). Na serwerze przykład nginx leży w
`deploy/nginx.conf.example`.

### Ręcznie

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

## Struktura

```
backend/
  prisma/            schemat i migracje
  scripts/           import streamerów i klipów z platform
  src/<moduł>/       moduły NestJS (streamers, platform-sync, communities, gateway, admin, …)
frontend/
  messages/          tłumaczenia pl / en
  src/app/           trasy Next.js
  src/components/    komponenty interfejsu
  src/lib/           klient API, kontekst logowania, typy
```

## Powiadomienie o instalacji (dobrowolne)

Na końcu `install.sh` pyta, czy wysłać autorowi jedno powiadomienie, że
projekt został postawiony. **Domyślnie nic się nie wysyła** — dopiero po
wyraźnym „tak”. Ping zawiera wyłącznie nazwę projektu, wersję i datę; nie
wysyła adresu IP, nazwy serwera ani żadnych danych instalującego.

Funkcja działa tylko, gdy ustawiony jest adres powiadomień
(`NOTIFY_URL_DEFAULT` w skrypcie lub `INSTALL_NOTIFY_URL`). W publikowanym
kodzie jest pusty, więc bez konfiguracji pytanie w ogóle się nie pojawia.
Można ją wyłączyć z góry: `INSTALL_NO_TELEMETRY=1 ./install.sh`.

## Licencja

Kod udostępniony do wglądu. Wszystkie prawa zastrzeżone. W sprawie
wykorzystania napisz przez GitHub: [@V-SGFX](https://github.com/V-SGFX).
