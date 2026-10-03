-- Angielska treść artykułu.
--
-- Tytuł i zajawka miały wariant EN od dawna, treść nie — a to ona jest tym,
-- po co ktoś wchodzi w artykuł. Przy angielskim interfejsie widać było
-- angielski nagłówek i polską treść pod nim.
ALTER TABLE "news" ADD COLUMN "content_en" TEXT;
