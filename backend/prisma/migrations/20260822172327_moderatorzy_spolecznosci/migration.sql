-- Moderatorzy społeczności: nominacja przez właściciela, zatwierdzenie przez administratora.
--
-- Tabela istniała wcześniej, ale nic z niej nie czytało. Kolumna status
-- zamienia ją w realne nadanie uprawnień: dopiero wiersz ACTIVE cokolwiek daje.

CREATE TYPE "ModeratorStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- updated_at dostaje wartość domyślną, inaczej NOT NULL nie przejdzie
-- przez istniejące wiersze.
ALTER TABLE "community_moderators"
  ADD COLUMN "approved_at"     TIMESTAMP(3),
  ADD COLUMN "approved_by_id"  INTEGER,
  ADD COLUMN "nominated_by_id" INTEGER,
  ADD COLUMN "reason"          TEXT,
  ADD COLUMN "revoked_at"      TIMESTAMP(3),
  ADD COLUMN "status"          "ModeratorStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Wiersze sprzed tej migracji powstawały wyłącznie przy zakładaniu
-- społeczności, czyli dotyczą jej twórców. Zostawienie ich jako PENDING
-- odebrałoby im uprawnienia, których formalnie nigdy nie mieli, ale które
-- wynikają z założenia społeczności. Wchodzą jako ACTIVE, zatwierdzone
-- przez siebie.
UPDATE "community_moderators" cm
SET "status"         = 'ACTIVE',
    "approved_at"    = cm."created_at",
    "nominated_by_id" = c."created_by_id",
    "approved_by_id"  = c."created_by_id"
FROM "communities" c
WHERE c."id" = cm."community_id";

CREATE INDEX "community_moderators_status_idx" ON "community_moderators"("status");

ALTER TABLE "community_moderators"
  ADD CONSTRAINT "community_moderators_nominated_by_id_fkey"
  FOREIGN KEY ("nominated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_moderators"
  ADD CONSTRAINT "community_moderators_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
