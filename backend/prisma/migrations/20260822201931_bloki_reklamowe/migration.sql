-- Bloki reklamowe zarządzane z panelu administracyjnego.

CREATE TABLE "ad_slots" (
    "id"          SERIAL       NOT NULL,
    "key"         TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "description" TEXT,
    "code"        TEXT,
    "is_active"   BOOLEAN      NOT NULL DEFAULT false,
    "position"    INTEGER      NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ad_slots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ad_slots_key_key" ON "ad_slots"("key");
CREATE INDEX "ad_slots_is_active_idx" ON "ad_slots"("is_active");

-- Bloki zakładamy z góry, wyłączone i bez kodu.
--
-- Pusta tabela zostawiłaby administratora przed formularzem, w którym musi
-- sam wymyślić klucz — a klucz jest kontraktem z kodem strony i literówka
-- w nim daje blok, który nigdy się nie pokaże, bez żadnego komunikatu.
-- Opisy mówią dokładnie, gdzie każdy z nich ląduje.
INSERT INTO "ad_slots" ("key", "name", "description", "is_active", "position") VALUES
  ('home-top',      'Strona główna — nad kanałem',
   'Pas nad pierwszym postem na stronie głównej. Najlepiej widoczne miejsce w serwisie; format poziomy, np. 728x90 lub responsywny.', false, 10),
  ('feed-inline',   'Kanał — co 8 postów',
   'Wstawka wewnątrz kanału, powtarzana co ósmy post. Format kwadratowy lub responsywny; wygląda jak karta postu, więc nie rozbija układu.', false, 20),
  ('sidebar-right', 'Prawa kolumna',
   'Kolumna po prawej, widoczna od szerokości 1280 px. Format pionowy, np. 300x600. Na telefonie nie wyświetla się wcale.', false, 30),
  ('post-detail',   'Pod treścią posta',
   'Między treścią posta a listą komentarzy. Czytelnik jest tu najbardziej zaangażowany; format poziomy lub responsywny.', false, 40),
  ('discover-top',  'Odkrywaj — nad zakładkami',
   'Pas nad zakładkami na stronie Odkrywaj. Ruch z wyszukiwarek trafia tu często jako pierwsze miejsce.', false, 50);

-- Zgodność schematu: kolumnę dodaliśmy wcześniej z wartością domyślną, żeby
-- NOT NULL przeszło przez istniejące wiersze. Prisma ustawia @updatedAt sama
-- przy każdym zapisie, więc wartość domyślna nie jest już potrzebna.
ALTER TABLE "community_moderators" ALTER COLUMN "updated_at" DROP DEFAULT;
