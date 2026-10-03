#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
#  XDTV.fans — instalacja po `git clone`
#
#    ./install.sh
#
#  Zakłada .env backendu i .env.local frontu, losuje sekrety, instaluje
#  zależności, zakłada tabele, tworzy konto administratora i buduje
#  obie części. Hasło administratora trafia WYŁĄCZNIE do procesu seeda —
#  nie jest zapisywane w żadnym pliku.
#
#  Bez pytań (np. w CI) — wszystko przez zmienne:
#    INSTALL_DOMAIN, INSTALL_DATABASE_URL, INSTALL_REDIS_HOST,
#    INSTALL_REDIS_PORT, INSTALL_ADMIN_EMAIL, INSTALL_ADMIN_PASSWORD,
#    INSTALL_SKIP_BUILD=1
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

NAME="XDTV.fans"
API_PORT=4000
WEB_PORT=3000
DB_NAME="xdtv"

cd "$(dirname "$0")"
ROOT="$(pwd)"

info() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[31mBłąd: %s\033[0m\n' "$*" >&2; exit 1; }

ask() { # ask ZMIENNA "Pytanie" "domyślna"
  local var=$1 prompt=$2 def=${3:-} val=${!1:-}
  if [ -z "$val" ]; then
    read -r -p "$prompt${def:+ [$def]}: " val
    val=${val:-$def}
  fi
  [ -n "$val" ] || fail "$prompt — wartość jest wymagana"
  printf -v "$var" '%s' "$val"
}

secret() { node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"; }

# Adres powiadomień autora. Pusty = funkcja niedostępna; wypełnij własnym
# endpointem (np. formularz Formspree kierujący na Twoją skrzynkę), jeśli
# chcesz dostawać dobrowolne powiadomienia o instalacjach.
NOTIFY_URL_DEFAULT="https://formspree.io/f/xnpnewwd"

# notify_author — wysyła JEDEN minimalny ping (nazwa projektu, wersja, data).
# Bez adresu IP, nazwy hosta i jakichkolwiek danych instalującego.
notify_author() {
  local url=$1
  local payload
  payload=$(node -e "process.stdout.write(JSON.stringify({projekt:'$NAME',wersja:process.env.npm_package_version||'?',data:new Date().toISOString()}))" 2>/dev/null \
    || printf '{"projekt":"%s"}' "$NAME")
  if command -v curl >/dev/null; then
    curl -fsS -m 10 -X POST -H 'Content-Type: application/json' -d "$payload" "$url" >/dev/null 2>&1 \
      && echo "Powiadomienie wysłane. Dziękujemy!" \
      || echo "Nie udało się wysłać powiadomienia (pomijam — instalacja jest gotowa)."
  else
    echo "Brak curl — pomijam powiadomienie."
  fi
}

# set_env PLIK KLUCZ WARTOŚĆ — podmienia wiersz KLUCZ=… albo dopisuje go na końcu
set_env() {
  node - "$1" "$2" "$3" <<'JS'
const fs = require('fs');
const [file, key, value] = process.argv.slice(2);
const line = `${key}=${JSON.stringify(value)}`;
let s = fs.readFileSync(file, 'utf8');
const re = new RegExp(`^${key}=.*$`, 'm');
s = re.test(s) ? s.replace(re, () => line) : s.replace(/\n?$/, `\n${line}\n`);
fs.writeFileSync(file, s);
JS
}

# ── Wymagania ──────────────────────────────────────────────────────
info "Sprawdzam wymagania"
command -v node >/dev/null || fail "brak Node.js (wymagany 20 lub nowszy)"
command -v npm  >/dev/null || fail "brak npm"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 20 ] || fail "Node.js $NODE_MAJOR — wymagany 20 lub nowszy"
echo "Node.js $(node -v)"

# ── Konfiguracja ───────────────────────────────────────────────────
BACKEND_ENV="$ROOT/backend/.env"
FRONTEND_ENV="$ROOT/frontend/.env.local"

if [ -f "$BACKEND_ENV" ]; then
  info "backend/.env już istnieje — zostawiam go bez zmian"
  KEEP_ENV=1
else
  KEEP_ENV=0
  info "Konfiguracja"
  echo "Baza PostgreSQL musi istnieć; instalator zakłada w niej tabele, nie samą bazę."
  ask INSTALL_DOMAIN       "Domena serwisu (bez https://; localhost do testów)" "localhost"
  ask INSTALL_DATABASE_URL "Adres bazy" "postgresql://$DB_NAME:HASLO@127.0.0.1:5432/$DB_NAME?schema=public"
  ask INSTALL_REDIS_HOST   "Redis — host" "127.0.0.1"
  ask INSTALL_REDIS_PORT   "Redis — port" "6379"
  ask INSTALL_ADMIN_EMAIL  "E-mail administratora" "admin@$INSTALL_DOMAIN"
fi

if [ "$KEEP_ENV" = 0 ]; then
  if [ "$INSTALL_DOMAIN" = "localhost" ]; then
    SITE_URL="http://localhost:$WEB_PORT"
  else
    SITE_URL="https://$INSTALL_DOMAIN"
  fi

  cp backend/.env.example "$BACKEND_ENV"
  chmod 600 "$BACKEND_ENV"
  set_env "$BACKEND_ENV" DATABASE_URL        "$INSTALL_DATABASE_URL"
  set_env "$BACKEND_ENV" REDIS_HOST          "$INSTALL_REDIS_HOST"
  set_env "$BACKEND_ENV" REDIS_PORT          "$INSTALL_REDIS_PORT"
  set_env "$BACKEND_ENV" JWT_SECRET          "$(secret)"
  set_env "$BACKEND_ENV" SESSION_SECRET      "$(secret)"
  set_env "$BACKEND_ENV" ADMIN_COOKIE_SECRET "$(secret)"
  set_env "$BACKEND_ENV" APP_URL             "$SITE_URL"
  set_env "$BACKEND_ENV" FRONTEND_URL        "$SITE_URL"
  set_env "$BACKEND_ENV" CORS_ORIGIN         "$SITE_URL,http://127.0.0.1:$WEB_PORT"
  set_env "$BACKEND_ENV" SEED_ADMIN_EMAIL    "$INSTALL_ADMIN_EMAIL"
  set_env "$BACKEND_ENV" SEED_ADMIN_PASSWORD ""
  set_env "$BACKEND_ENV" SMTP_FROM           "$NAME <noreply@${INSTALL_DOMAIN}>"

  # Lokalnie przeglądarka woła API bezpośrednio; na domenie — przez nginx.
  if [ "$INSTALL_DOMAIN" = "localhost" ]; then PUBLIC_API="http://localhost:$API_PORT"; else PUBLIC_API="$SITE_URL"; fi
  cp frontend/.env.example "$FRONTEND_ENV"
  chmod 600 "$FRONTEND_ENV"
  set_env "$FRONTEND_ENV" NEXT_PUBLIC_API_URL "$PUBLIC_API"
  set_env "$FRONTEND_ENV" API_INTERNAL_URL    "http://127.0.0.1:$API_PORT"
  echo "Zapisano backend/.env i frontend/.env.local (sekrety wylosowane)."
fi

# ── Hasło administratora — tylko dla seeda ─────────────────────────
ADMIN_PASSWORD=${INSTALL_ADMIN_PASSWORD:-}
if [ -z "$ADMIN_PASSWORD" ]; then
  info "Konto administratora"
  echo "Hasło nie zostanie nigdzie zapisane. Jeśli konto już istnieje, seed go nie zmieni."
  while :; do
    read -r -s -p "Hasło administratora (min. 12 znaków): " ADMIN_PASSWORD; echo
    [ ${#ADMIN_PASSWORD} -ge 12 ] || { echo "Za krótkie."; continue; }
    read -r -s -p "Powtórz hasło: " CONFIRM; echo
    [ "$ADMIN_PASSWORD" = "$CONFIRM" ] && break
    echo "Hasła się różnią."
  done
  unset CONFIRM
fi
[ ${#ADMIN_PASSWORD} -ge 12 ] || fail "hasło administratora musi mieć co najmniej 12 znaków"

# ── Backend ────────────────────────────────────────────────────────
info "Backend: zależności"
(cd backend && npm ci)

info "Backend: tabele w bazie"
(cd backend && npx prisma generate && npx prisma migrate deploy)

info "Backend: dane startowe i administrator"
(cd backend && SEED_ADMIN_PASSWORD="$ADMIN_PASSWORD" npm run seed)
unset ADMIN_PASSWORD INSTALL_ADMIN_PASSWORD

# ── Frontend ───────────────────────────────────────────────────────
info "Frontend: zależności"
(cd frontend && npm ci)

if [ "${INSTALL_SKIP_BUILD:-0}" != 1 ]; then
  info "Budowanie"
  (cd backend && npm run build)
  (cd frontend && npm run build)
fi

# ── Dobrowolne powiadomienie autora (domyślnie: nie) ───────────────
# Nic nie wysyła się bez wyraźnej zgody. Wyłączenie z góry: INSTALL_NO_TELEMETRY=1
NOTIFY_URL=${INSTALL_NOTIFY_URL:-$NOTIFY_URL_DEFAULT}
if [ "${INSTALL_NO_TELEMETRY:-0}" != 1 ] && [ -n "$NOTIFY_URL" ]; then
  SEND=${INSTALL_SEND_TELEMETRY:-}
  if [ -z "$SEND" ]; then
    info "Powiadomienie autora (dobrowolne)"
    echo "Mogę wysłać autorowi JEDNO powiadomienie, że postawiono projekt."
    echo "Wysyłane: nazwa projektu, wersja i data. Nie wysyłam adresu IP,"
    echo "nazwy serwera ani żadnych Twoich danych. Adres: $NOTIFY_URL"
    read -r -p "Wysłać? (t/N): " SEND
  fi
  case "$SEND" in [tTyY]*) notify_author "$NOTIFY_URL";; *) echo "Pomijam — nic nie wysłano.";; esac
fi

cat <<EOF

────────────────────────────────────────────────────────────────────
 $NAME zainstalowany.

 Uruchomienie:
   cd backend  && npm start        # API   → http://127.0.0.1:$API_PORT/api, panel /admin
   cd frontend && npm start        # strona → http://127.0.0.1:$WEB_PORT

 Na serwerze uruchom oba procesy przez pm2 lub systemd, a przed nimi
 postaw nginx — przykład w deploy/nginx.conf.example.

 Opcjonalne (poczta, platformy Twitch/YouTube/Kick/TikTok, logowanie, Stripe) włączasz,
 uzupełniając backend/.env — opis przy każdej zmiennej.
────────────────────────────────────────────────────────────────────
EOF
