/**
 * Odmiana rzeczownika przez liczbę — po polsku.
 *
 * Polski ma trzy formy tam, gdzie angielski ma dwie: 1 komentarz,
 * 2 komentarze, 5 komentarzy. Sklejanie liczby z formą mnogą daje
 * „1 komentarzy", co widać było pod każdym materiałem wyprowadzonym
 * z dyskusji.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const last = abs % 10;
  const lastTwo = abs % 100;
  // 12–14 idą z formą dopełniaczową mimo końcówki 2–4.
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

/** Liczba razem z odmienionym rzeczownikiem: „3 komentarze". */
export function countLabel(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}
