-- Usunięcie tabel synchronizacji Steama.
--
-- Kod modułu zniknął wcześniej. Tabele zostawały do osobnej decyzji, bo
-- skasowanie danych jest nieodwracalne — nawet gdy dane to 279 wpisów
-- z dziennika przebiegów, które wszystkie zaimportowały zero rekordów.
-- Zrzut leży w ~/archiwum-xdtv-v1-20260822/steam-tabele.sql.

ALTER TABLE "proton_reports"  DROP CONSTRAINT "proton_reports_game_id_fkey";
ALTER TABLE "steam_sync_logs" DROP CONSTRAINT "steam_sync_logs_game_id_fkey";

DROP TABLE "proton_reports";
DROP TABLE "steam_sync_logs";
DROP TABLE "sync_settings";
DROP TABLE "steam_games";

DROP TYPE "ProtonTier";
DROP TYPE "SteamDeckVerdict";
DROP TYPE "SyncSource";
DROP TYPE "SyncStatus";

-- Zgodność schematu: kolumnę dodaliśmy z wartością domyślną, żeby NOT NULL
-- przeszło przez tabelę zakładaną w tej samej migracji. Prisma ustawia
-- @updatedAt sama przy każdym zapisie.
ALTER TABLE "ad_slots" ALTER COLUMN "updated_at" DROP DEFAULT;
