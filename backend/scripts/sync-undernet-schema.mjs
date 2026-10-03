#!/usr/bin/env node
/**
 * Odświeżenie kopii schematu UNDERNET.ONE wewnątrz backendu xdtv.
 *
 * Wspólny AdminJS obsługuje dwie bazy jednym panelem: adapter
 * @adminjs/prisma przyjmuje moduł klienta jako drugi argument
 * `getModelByName`, więc wystarczy DRUGI wygenerowany klient. Ten klient
 * potrzebuje własnego pliku schematu — i to jest kopia.
 *
 * Kopia potrafi się po cichu rozjechać, bo nic jej nie pilnuje. Tak było
 * 2026-08-30: undernet zdjął ze swojego `User` kolumny twitch_id, kick_id,
 * youtube_id i tiktok_id, kopia dalej je deklarowała, a AdminJS budował
 * z niej SELECT-a po nieistniejących kolumnach. Efekt: /admin/resources/
 * UndernetUser wywalał się przy każdym wejściu.
 *
 * Skrypt przepisuje schemat źródłowy i podmienia dokładnie dwie rzeczy:
 * miejsce, gdzie ląduje klient, oraz nazwę zmiennej z adresem bazy.
 *
 *   node scripts/sync-undernet-schema.mjs        — odśwież
 *   node scripts/sync-undernet-schema.mjs --check — sprawdź bez zapisu
 *
 * Po odświeżeniu: `npx prisma generate --schema prisma/undernet/schema.prisma`
 * i restart procesu, bo DMMF wczytuje się przy starcie.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = process.env.UNDERNET_SCHEMA
  ?? '/var/www/undernetone/backend/prisma/schema.prisma';
const TARGET = resolve(here, '../prisma/undernet/schema.prisma');

const NAGLOWEK = `// ─────────────────────────────────────────────────────────────────────
//  KOPIA — NIE EDYTUJ RĘCZNIE
//
//  Wygenerowane z: ${SOURCE}
//  Odświeżenie:    node scripts/sync-undernet-schema.mjs
//
//  Drugi klient Prismy, żeby wspólny AdminJS czytał bazę UNDERNET.ONE.
//  Zmiana modelu po tamtej stronie wymaga uruchomienia skryptu i
//  ponownego \`prisma generate\` — inaczej panel buduje zapytania po
//  kolumnach, których w bazie już nie ma.
// ─────────────────────────────────────────────────────────────────────

`;

if (!existsSync(SOURCE)) {
  console.error(`  BŁĄD: nie znaleziono schematu źródłowego: ${SOURCE}`);
  process.exit(1);
}

let s = readFileSync(SOURCE, 'utf8');

// Klient musi lądować obok głównego, pod własną nazwą.
const przed = s;
s = s.replace(
  /generator\s+client\s*\{([^}]*)\}/,
  (_m, body) => `generator client {${
    /output\s*=/.test(body)
      ? body.replace(/output\s*=\s*"[^"]*"/, 'output   = "../../node_modules/.prisma/client-undernet"')
      : `${body.replace(/\s*$/, '')}\n  output   = "../../node_modules/.prisma/client-undernet"\n`
  }}`,
);
if (s === przed) {
  console.error('  BŁĄD: nie rozpoznano bloku `generator client` w schemacie źródłowym.');
  process.exit(1);
}

// Adres drugiej bazy siedzi pod inną zmienną niż baza xdtv.
if (!/env\("DATABASE_URL"\)/.test(przed)) {
  console.error('  BŁĄD: nie znaleziono env("DATABASE_URL") — sprawdź schemat źródłowy.');
  process.exit(1);
}
s = s.replace(/env\("DATABASE_URL"\)/g, 'env("UNDERNET_DATABASE_URL")');

const wynik = NAGLOWEK + s;
const obecny = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : '';

if (process.argv.includes('--check')) {
  if (obecny === wynik) {
    console.log('  ✓ kopia jest aktualna');
    process.exit(0);
  }
  console.error('  ✗ kopia ROZJECHAŁA SIĘ ze schematem undernetu');
  console.error('    uruchom: node scripts/sync-undernet-schema.mjs');
  process.exit(1);
}

if (obecny === wynik) {
  console.log('  ✓ kopia była już aktualna — nic nie zmieniono');
} else {
  writeFileSync(TARGET, wynik, 'utf8');
  console.log(`  ✓ odświeżono ${TARGET}`);
  console.log('    teraz: npx prisma generate --schema prisma/undernet/schema.prisma');
}
